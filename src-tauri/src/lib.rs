//! Draften native shell (Tauri).
//!
//! The frontend (React/TS) owns the editor, model, and most importers. The Rust
//! side handles what's genuinely better native: heavy/binary file parsing and
//! filesystem/Git. The first such command decodes OmniGraffle files — gzip'd
//! Apple plist — into JSON the frontend's OmniGraffle importer can map into the
//! document model.

use std::io::Read;

use flate2::read::GzDecoder;
use serde::Serialize;

/// Result of decoding an OmniGraffle `.graffle` file: its plist as JSON, plus
/// notes about what we had to approximate. The TS importer maps this into the
/// Draften document model.
#[derive(Serialize)]
pub struct GraffleDecode {
    /// the plist decoded to a JSON value (objects/arrays/strings/numbers)
    pub json: serde_json::Value,
    pub warnings: Vec<String>,
}

/// Decode a `.graffle` file's bytes. OmniGraffle saves either a flat gzip'd plist
/// or a package; this handles the common flat/gzip case and plain plist, and
/// tells the caller (via warnings) when it fell back.
#[tauri::command]
fn decode_omnigraffle(bytes: Vec<u8>) -> Result<GraffleDecode, String> {
    let mut warnings = Vec::new();

    // OmniGraffle gzip files start with 1F 8B. Ungzip if so; else assume raw plist.
    let plist_bytes: Vec<u8> = if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        let mut d = GzDecoder::new(&bytes[..]);
        let mut out = Vec::new();
        d.read_to_end(&mut out)
            .map_err(|e| format!("gzip decode failed: {e}"))?;
        out
    } else {
        warnings.push("File was not gzip'd; parsing as a raw plist.".into());
        bytes
    };

    // Parse the Apple plist (binary or XML — the crate autodetects).
    let value: plist::Value = plist::from_bytes(&plist_bytes)
        .map_err(|e| format!("plist parse failed: {e}"))?;

    let json = plist_to_json(&value);
    Ok(GraffleDecode { json, warnings })
}

/// Convert a plist Value into a serde_json Value so the TS side gets plain JSON.
fn plist_to_json(v: &plist::Value) -> serde_json::Value {
    use serde_json::Value as J;
    match v {
        plist::Value::Array(a) => J::Array(a.iter().map(plist_to_json).collect()),
        plist::Value::Dictionary(d) => {
            let mut map = serde_json::Map::new();
            for (k, val) in d.iter() {
                map.insert(k.clone(), plist_to_json(val));
            }
            J::Object(map)
        }
        plist::Value::Boolean(b) => J::Bool(*b),
        plist::Value::Integer(i) => i
            .as_signed()
            .map(|n| J::Number(n.into()))
            .unwrap_or(J::Null),
        plist::Value::Real(r) => serde_json::Number::from_f64(*r)
            .map(J::Number)
            .unwrap_or(J::Null),
        plist::Value::String(s) => J::String(s.clone()),
        plist::Value::Date(date) => J::String(format!("{date:?}")),
        plist::Value::Data(bytes) => {
            // represent binary data as base64-ish length note (images handled later)
            J::String(format!("<data:{} bytes>", bytes.len()))
        }
        _ => J::Null,
    }
}

/// App version, so the frontend can display + version-check against the shell.
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![decode_omnigraffle, app_version])
        .run(tauri::generate_context!())
        .expect("error while running Draften");
}
