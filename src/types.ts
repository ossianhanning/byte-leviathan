export interface Tag {
  start: number;
  end: number;
  name: string;
  displayName: string;
  color?: string;
}

export interface Selection {
  start: number;
  end: number;
  byteCount: number;
  selectionType: 'bytes' | 'text';
}

export interface HexViewerProps {
  fileLength: number;
  onRequestData: (start: number, end: number) => Promise<Uint8Array>;
  onSelectionChange?: (selection: Selection | null) => void;
  tags: Tag[];
}