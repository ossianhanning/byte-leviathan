#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Tag {
    start: u64,
    end: u64,
    name: String,
    display_name: String,
    color: Option<String>,
}

struct FileState {
    file_path: Option<PathBuf>,
    file: Option<File>,
    file_size: u64,
    tags: Vec<Tag>,
}

impl FileState {
    fn new() -> Self {
        Self {
            file_path: None,
            file: None,
            file_size: 0,
            tags: Vec::new(),
        }
    }
}

type AppState = Arc<Mutex<FileState>>;

#[tauri::command]
fn open_file(path: String, state: State<AppState>) -> Result<u64, String> {
    let path = PathBuf::from(path);

    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;

    let metadata = file
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let file_size = metadata.len();

    let mut app_state = state.lock().unwrap();
    app_state.file_path = Some(path);
    app_state.file = Some(file);
    app_state.file_size = file_size;
    app_state.tags.clear();
    Ok(file_size)
}

#[tauri::command]
fn get_file_data(start: u64, end: u64, state: State<AppState>) -> Result<Vec<u8>, String> {
    let mut app_state = state.lock().unwrap();

    if end <= start {
        return Err("End position must be greater than start position".to_string());
    }
    if app_state.file.is_none() {
        return Err("No file is currently open".to_string());
    }
    let file_size = app_state.file_size;
    if start >= file_size {
        return Err(format!(
            "Start position {} exceeds file size {}",
            start, file_size
        ));
    }

    let end = std::cmp::min(end, file_size);
    const ALIGNMENT: u64 = 512;

    let aligned_start = (start / ALIGNMENT) * ALIGNMENT;

    let aligned_end = if end % ALIGNMENT == 0 {
        end
    } else {
        ((end / ALIGNMENT) + 1) * ALIGNMENT
    };
    let aligned_length = (aligned_end - aligned_start) as usize;

    let start_offset = (start - aligned_start) as usize;
    let requested_length = (end - start) as usize;

    let file = app_state.file.as_mut().unwrap();
    file.seek(SeekFrom::Start(aligned_start))
        .map_err(|e| format!("Failed to seek to position {}: {}", aligned_start, e))?;

    let mut aligned_buffer = vec![0u8; aligned_length];
    file.read_exact(&mut aligned_buffer).map_err(|e| {
        if e.kind() == io::ErrorKind::UnexpectedEof {
            format!("Unexpected EOF when reading file data")
        } else {
            format!("Failed to read file data: {}", e)
        }
    })?;

    Ok(aligned_buffer[start_offset..start_offset + requested_length].to_vec())
}

#[tauri::command]
fn get_tags_in_range(start: u64, end: u64, state: State<AppState>) -> Result<Vec<Tag>, String> {
    let app_state = state.lock().unwrap();

    let tags_in_range: Vec<Tag> = app_state
        .tags
        .iter()
        .filter(|tag| tag.end >= start && tag.start <= end)
        .cloned()
        .collect();
    Ok(tags_in_range)
}

#[tauri::command]
fn get_all_tags(state: State<AppState>) -> Result<Vec<Tag>, String> {
    let app_state = state.lock().unwrap();
    Ok(app_state.tags.clone())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(Mutex::new(FileState::new())))
        .invoke_handler(tauri::generate_handler![
            open_file,
            get_file_data,
            get_tags_in_range,
            get_all_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
