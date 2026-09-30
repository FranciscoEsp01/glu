fn main() {
    println!("cargo:rerun-if-changed=native/Capture.swift");
    #[cfg(target_os = "macos")]
    {
        let target = std::env::var("OUT_DIR").unwrap();
        let result = std::process::Command::new("xcrun").args(["swiftc", "-parse-as-library", "-O", "-target", &format!("{}-apple-macosx15.0", if std::env::var("CARGO_CFG_TARGET_ARCH").unwrap() == "aarch64" { "arm64" } else { "x86_64" }), "native/Capture.swift", "-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", "Info.plist", "-o", &format!("{target}/glu-capture")]).status().expect("Swift compiler required");
        assert!(result.success(), "Could not compile native audio capture");
    }
    tauri_build::build()
}
