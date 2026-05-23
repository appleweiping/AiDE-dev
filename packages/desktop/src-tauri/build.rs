// build.rs — required by Tauri build system
// Icons should be placed in src-tauri/icons/:
//   icon.png, icon.ico, icon.icns, 32x32.png, 128x128.png, 128x128@2x.png
// Generate them with: npx @tauri-apps/cli icon path/to/source.png

fn main() {
    tauri_build::build()
}
