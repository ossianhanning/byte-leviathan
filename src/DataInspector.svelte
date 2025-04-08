<script lang="ts">
    import type { Selection } from './types';

    export let selection: Selection | null = null;
    export let getBytes: (start: number, length: number) => Uint8Array | null;

    let categories: { name: string; values: { name: string; value: string; color?: string }[] }[] = [];

    $: if (selection) {
      updateDisplayValues();
    } else {
      categories = [];
    }

    function updateDisplayValues() {
      if (!selection) return;
      
      const start = Math.min(selection.start, selection.end);

      const maxBytes = 8;
      const bytes = getBytes(start, maxBytes);
      if (!bytes) return;
      
      try {

        let integerValues = [];

        const bin = bytes[0].toString(2).padStart(8, '0');
        integerValues.push({ name: "Binary (8-bit)", value: `0b${bin}`, color: "#60c689" });

        integerValues.push({ name: "uint8", value: bytes[0].toString(), color: "#adc2ff" });
        integerValues.push({ name: "int8", value: new Int8Array([bytes[0]])[0].toString(), color: "#adc2ff" });

        if (bytes.length >= 2) {
          const view = new DataView(bytes.buffer);
          integerValues.push({ name: "uint16", value: view.getUint16(0, true).toString(), color: "#ffa344" });
          integerValues.push({ name: "int16", value: view.getInt16(0, true).toString(), color: "#ffa344" });
        }

        if (bytes.length >= 3) {
          const uint24 = (bytes[2] << 16) | (bytes[1] << 8) | bytes[0];
          let int24 = uint24;
          if (int24 & 0x800000) int24 = int24 - 0x1000000; // Sign extension
          integerValues.push({ name: "uint24", value: uint24.toString(), color: "#f5a742" });
          integerValues.push({ name: "int24", value: int24.toString(), color: "#f5a742" });
        }

        if (bytes.length >= 4) {
          const view = new DataView(bytes.buffer);
          integerValues.push({ name: "uint32", value: view.getUint32(0, true).toString(), color: "#f28779" });
          integerValues.push({ name: "int32", value: view.getInt32(0, true).toString(), color: "#f28779" });
        }

        if (bytes.length >= 8) {
          const view = new DataView(bytes.buffer);
          const bigUint = view.getBigUint64(0, true);
          const bigInt = view.getBigInt64(0, true);
          
          integerValues.push({ name: "uint64", value: bigUint.toString(), color: "#ff79c6" });
          integerValues.push({ name: "int64", value: bigInt.toString(), color: "#ff79c6" });
        }

        let floatValues = [];

        if (bytes.length >= 4) {
          const view = new DataView(bytes.buffer);
          const floatValue = view.getFloat32(0, true);
          floatValues.push({ 
            name: "float (32-bit)", 
            value: Number.isFinite(floatValue) ? floatValue.toString() : (floatValue === Infinity ? "Infinity" : "-Infinity"),
            color: "#60b8ff" 
          });
        }

        if (bytes.length >= 8) {
          const view = new DataView(bytes.buffer);
          const doubleValue = view.getFloat64(0, true);
          floatValues.push({ 
            name: "double (64-bit)", 
            value: Number.isFinite(doubleValue) ? doubleValue.toString() : (doubleValue === Infinity ? "Infinity" : doubleValue === -Infinity ? "-Infinity" : "NaN"),
            color: "#ae8fff"
          });
        }

        let otherValues = [];

        otherValues.push({ name: "bool", value: bytes[0] ? "true" : "false", color: "#60c689" });

        categories = [
          { name: "Integers", values: integerValues },
          { name: "Floating Point", values: floatValues },
          { name: "Other", values: otherValues }
        ];
      } catch (error) {
        console.error("Error parsing bytes:", error);
      }
    }
  </script>
  
  <div class="data-inspector">
    <div class="inspector-header">
      <div class="header-icon">⬢</div>
      <h3>Data Inspector</h3>
    </div>
    
    <div class="inspector-content">
      {#if categories.length > 0}
        <div class="categories">
          {#each categories as category}
            <div class="category">
              <div class="category-header">{category.name}</div>
              <table>
                <tbody>
                {#each category.values as item}
                  <tr>
                    <td class="type-cell">{item.name}</td>
                    <td class="value-cell" style={item.color ? `color: ${item.color}` : ''}>{item.value}</td>
                  </tr>
                {/each}
                </tbody>
              </table>
            </div>
          {/each}
        </div>
      {:else}
        <div class="no-selection">
          <div class="no-selection-icon">⬢</div>
          <p>Select data to inspect</p>
          <div class="keyboard-tip">
            <span class="tip-title">Pro Tip:</span>
            <span>Use arrow keys to navigate bytes</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .data-inspector {
      background: linear-gradient(135deg, #1c2133 0%, #232942 100%);
      border-radius: 6px;
      overflow: hidden;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border: 1px solid #2a3550;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .inspector-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #2a3550;
      background: linear-gradient(90deg, #1f2740 0%, #2a3550 100%);
      height: 22px;
    }
    
    .header-icon {
      font-size: 18px;
      color: #60b8ff;
      margin-right: 10px;
      text-shadow: 0 0 8px rgba(96, 184, 255, 0.5);
    }
    
    .inspector-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #e4e9f5;
      letter-spacing: 0.3px;
    }
    
    .inspector-content {
      flex: 1;
      overflow: auto;
      padding: 0;
    }
    
    .categories {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
    }
    
    .category {
      background: rgba(21, 26, 46, 0.3);
      border-radius: 8px;
      border: 1px solid #2a3550;
      overflow: hidden;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    .category-header {
      padding: 10px 16px;
      font-weight: 600;
      font-size: 14px;
      color: #e4e9f5;
      background: rgba(42, 53, 80, 0.5);
      border-bottom: 1px solid #2a3550;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    tr {
      transition: background-color 0.15s ease;
    }
    
    tr:nth-child(odd) {
      background-color: rgba(21, 26, 46, 0.2);
    }
    
    tr:hover {
      background-color: rgba(96, 184, 255, 0.05);
    }
    
    td {
      padding: 8px 16px;
      line-height: 1.5;
    }
    
    .type-cell {
      width: 40%;
      color: #8597b9;
      font-weight: 500;
    }
      .value-cell {
      width: 60%;
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
      color: #e4e9f5;
      text-align: right;
    }
    
    .no-selection {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #8597b9;
      text-align: center;
      padding: 20px;
    }
    
    .no-selection-icon {
      font-size: 44px;
      margin-bottom: 16px;
      color: rgba(96, 184, 255, 0.2);
      opacity: 0.6;
    }
    
    .no-selection p {
      margin: 0 0 24px;
      font-size: 16px;
    }
    
    .keyboard-tip {
      margin-top: 16px;
      padding: 12px 16px;
      background: rgba(96, 184, 255, 0.05);
      border-radius: 6px;
      border-left: 2px solid #60b8ff;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
      max-width: 250px;
    }
    
    .tip-title {
      font-weight: 600;
      color: #60b8ff;
    }
  </style>