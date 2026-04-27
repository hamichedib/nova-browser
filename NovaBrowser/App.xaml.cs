using System;
using System.IO;
using System.Windows;
using CefSharp;
using CefSharp.Wpf;

namespace NovaBrowser
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            InitializeCef();
        }

        private static void InitializeCef()
        {
            var settings = new CefSettings
            {
                CachePath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Nova", "CefCache"),
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                            "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Nova/1.0",
                LogSeverity = LogSeverity.Warning,
            };

            settings.CefCommandLineArgs.Add("enable-media-stream");
            settings.CefCommandLineArgs.Add("enable-gpu");

            Cef.Initialize(settings);
        }

        protected override void OnExit(ExitEventArgs e)
        {
            Cef.Shutdown();
            base.OnExit(e);
        }
    }
}
