fn main() {
    #[cfg(windows)]
    {
        let mut res = winres::WindowsResource::new();
        if std::path::Path::new("assets/nova.ico").exists() {
            res.set_icon("assets/nova.ico");
        }
        res.set("ProductName", "Nova");
        res.set("FileDescription", "Nova — modern browser powered by Firefox");
        res.set("CompanyName", "Nova");
        res.set("LegalCopyright", "© Nova");
        res.set("OriginalFilename", "Nova.exe");
        res.set("InternalName", "Nova");
        let _ = res.compile();
    }
}
