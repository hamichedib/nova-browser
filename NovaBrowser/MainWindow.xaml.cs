using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using CefSharp;
using CefSharp.Wpf;
using Newtonsoft.Json;

namespace NovaBrowser
{
    public partial class MainWindow : Window
    {
        private readonly List<BrowserTab> _tabs = new();
        private BrowserTab? _activeTab;
        private readonly string _newTabUrl;
        private readonly string _bookmarksPath;
        private List<Bookmark> _bookmarks = new();

        public MainWindow()
        {
            InitializeComponent();

            var appData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Nova");
            Directory.CreateDirectory(appData);
            _bookmarksPath = Path.Combine(appData, "bookmarks.json");
            LoadBookmarks();

            var resourcePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "newtab.html");
            _newTabUrl = File.Exists(resourcePath)
                ? new Uri(resourcePath).AbsoluteUri
                : "about:blank";

            AddNewTab(_newTabUrl);

            KeyDown += MainWindow_KeyDown;
        }

        private string ResolveUrl(string input)
        {
            input = input.Trim();
            if (string.IsNullOrEmpty(input))
                return _newTabUrl;

            if (Uri.TryCreate(input, UriKind.Absolute, out var uri) &&
                (uri.Scheme == "http" || uri.Scheme == "https" || uri.Scheme == "file"))
                return input;

            if (System.Text.RegularExpressions.Regex.IsMatch(input,
                    @"^([a-z0-9\-]+\.)+[a-z]{2,}(\/|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return "https://" + input;

            return "https://www.google.com/search?q=" + Uri.EscapeDataString(input);
        }

        // ───── Tab Management ─────

        private void AddNewTab(string url)
        {
            var browser = new ChromiumWebBrowser();
            browser.LifeSpanHandler = new NovaLifeSpanHandler(this);
            browser.DownloadHandler = new NovaDownloadHandler(this);
            browser.RequestHandler = new NovaRequestHandler();

            var tab = new BrowserTab
            {
                Browser = browser,
                Title = "New Tab",
                Url = url,
            };

            browser.TitleChanged += (_, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    tab.Title = (args.NewValue as string) ?? "New Tab";
                    UpdateTabBar();
                    if (tab == _activeTab)
                        Title = $"{tab.Title} — Nova Browser";
                });
            };

            browser.AddressChanged += (_, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    tab.Url = (args.NewValue as string) ?? "";
                    if (tab == _activeTab)
                    {
                        AddressBar.Text = (args.NewValue as string) ?? "";
                        UpdateNavButtons();
                    }
                });
            };

            browser.LoadingStateChanged += (_, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (tab == _activeTab)
                    {
                        StatusText.Text = args.IsLoading ? "Loading..." : "Ready";
                        UpdateNavButtons();
                    }
                });
            };

            browser.StatusMessage += (_, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (tab == _activeTab)
                        StatusText.Text = string.IsNullOrEmpty(args.Value) ? "Ready" : args.Value;
                });
            };

            browser.Address = url;

            _tabs.Add(tab);
            SwitchToTab(tab);
            UpdateTabBar();
        }

        public void AddNewTabFromUrl(string url)
        {
            Dispatcher.Invoke(() => AddNewTab(url));
        }

        private void SwitchToTab(BrowserTab tab)
        {
            if (_activeTab != null)
                BrowserContainer.Children.Remove(_activeTab.Browser);

            _activeTab = tab;
            BrowserContainer.Children.Clear();
            BrowserContainer.Children.Add(tab.Browser);

            AddressBar.Text = tab.Url;
            Title = $"{tab.Title} — Nova Browser";
            UpdateNavButtons();
            UpdateTabBar();
        }

        private void CloseTab(BrowserTab tab)
        {
            if (_tabs.Count == 1)
            {
                Close();
                return;
            }

            var idx = _tabs.IndexOf(tab);
            _tabs.Remove(tab);

            if (tab == _activeTab)
            {
                var newIdx = Math.Min(idx, _tabs.Count - 1);
                SwitchToTab(_tabs[newIdx]);
            }

            tab.Browser.Dispose();
            UpdateTabBar();
        }

        private void UpdateTabBar()
        {
            TabBar.Children.Clear();

            foreach (var tab in _tabs)
            {
                var panel = new DockPanel { LastChildFill = true };

                var closeBtn = new Button
                {
                    Style = (Style)FindResource("CloseTabButton"),
                    Tag = tab,
                    Margin = new Thickness(4, 0, 0, 0),
                };
                closeBtn.Click += (_, _) => CloseTab(tab);
                DockPanel.SetDock(closeBtn, Dock.Right);
                panel.Children.Add(closeBtn);

                var titleBlock = new TextBlock
                {
                    Text = TruncateTitle(tab.Title, 22),
                    VerticalAlignment = VerticalAlignment.Center,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    Foreground = (SolidColorBrush)FindResource("NovaTextBrush"),
                    FontSize = 13,
                };
                panel.Children.Add(titleBlock);

                var tabBtn = new Button
                {
                    Style = (Style)FindResource("TabButton"),
                    Content = panel,
                    Tag = tab,
                };

                if (tab == _activeTab)
                {
                    tabBtn.Background = new LinearGradientBrush(
                        Color.FromArgb(0x59, 0x8A, 0x5C, 0xFF),
                        Color.FromArgb(0x2E, 0x4C, 0xD9, 0xFF),
                        45);
                }

                tabBtn.Click += (s, _) =>
                {
                    if (s is Button btn && btn.Tag is BrowserTab t)
                        SwitchToTab(t);
                };

                TabBar.Children.Add(tabBtn);
            }
        }

        private static string TruncateTitle(string title, int maxLen)
        {
            if (string.IsNullOrEmpty(title)) return "New Tab";
            return title.Length <= maxLen ? title : title[..(maxLen - 1)] + "…";
        }

        private void UpdateNavButtons()
        {
            if (_activeTab == null) return;
            BtnBack.IsEnabled = _activeTab.Browser.CanGoBack;
            BtnForward.IsEnabled = _activeTab.Browser.CanGoForward;
        }

        // ───── Navigation Event Handlers ─────

        private void Back_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.Browser.Back();
        }

        private void Forward_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.Browser.Forward();
        }

        private void Refresh_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.Browser.Reload();
        }

        private void Home_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.Browser.Load(_newTabUrl);
        }

        private void NewTab_Click(object sender, RoutedEventArgs e)
        {
            AddNewTab(_newTabUrl);
        }

        private void AddressBar_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                var url = ResolveUrl(AddressBar.Text);
                _activeTab?.Browser.Load(url);
                _activeTab?.Browser.Focus();
            }
        }

        private void AddressBar_GotFocus(object sender, RoutedEventArgs e)
        {
            AddressBar.SelectAll();
        }

        // ───── Bookmarks ─────

        private void Bookmark_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab == null) return;

            var existing = _bookmarks.FirstOrDefault(b => b.Url == _activeTab.Url);
            if (existing != null)
            {
                _bookmarks.Remove(existing);
                StatusText.Text = "Bookmark removed";
            }
            else
            {
                _bookmarks.Add(new Bookmark
                {
                    Title = _activeTab.Title,
                    Url = _activeTab.Url,
                    AddedAt = DateTime.UtcNow,
                });
                StatusText.Text = "Bookmark added";
            }
            SaveBookmarks();
        }

        private void LoadBookmarks()
        {
            if (File.Exists(_bookmarksPath))
            {
                try
                {
                    var json = File.ReadAllText(_bookmarksPath);
                    _bookmarks = JsonConvert.DeserializeObject<List<Bookmark>>(json) ?? new();
                }
                catch
                {
                    _bookmarks = new();
                }
            }
        }

        private void SaveBookmarks()
        {
            var json = JsonConvert.SerializeObject(_bookmarks, Formatting.Indented);
            File.WriteAllText(_bookmarksPath, json);
        }

        // ───── Downloads ─────

        private void Downloads_Click(object sender, RoutedEventArgs e)
        {
            var downloadsPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            if (Directory.Exists(downloadsPath))
                System.Diagnostics.Process.Start("explorer.exe", downloadsPath);
        }

        // ───── Settings ─────

        private void Settings_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.Browser.Load("chrome://settings");
        }

        // ───── Keyboard shortcuts ─────

        private void MainWindow_KeyDown(object sender, KeyEventArgs e)
        {
            if (Keyboard.Modifiers == ModifierKeys.Control)
            {
                switch (e.Key)
                {
                    case Key.T:
                        AddNewTab(_newTabUrl);
                        e.Handled = true;
                        break;
                    case Key.W:
                        if (_activeTab != null) CloseTab(_activeTab);
                        e.Handled = true;
                        break;
                    case Key.L:
                        AddressBar.Focus();
                        AddressBar.SelectAll();
                        e.Handled = true;
                        break;
                    case Key.R:
                        _activeTab?.Browser.Reload();
                        e.Handled = true;
                        break;
                    case Key.Tab:
                        if (_tabs.Count > 1)
                        {
                            var idx = _tabs.IndexOf(_activeTab!);
                            var next = (idx + 1) % _tabs.Count;
                            SwitchToTab(_tabs[next]);
                        }
                        e.Handled = true;
                        break;
                }
            }

            if (e.Key == Key.F5)
            {
                _activeTab?.Browser.Reload();
                e.Handled = true;
            }

            if (e.Key == Key.F11)
            {
                WindowState = WindowState == WindowState.Maximized
                    ? WindowState.Normal
                    : WindowState.Maximized;
                e.Handled = true;
            }

            if (Keyboard.Modifiers == ModifierKeys.Alt)
            {
                if (e.SystemKey == Key.Left)
                {
                    _activeTab?.Browser.Back();
                    e.Handled = true;
                }
                else if (e.SystemKey == Key.Right)
                {
                    _activeTab?.Browser.Forward();
                    e.Handled = true;
                }
            }
        }

        public void UpdateStatus(string message)
        {
            Dispatcher.Invoke(() => StatusText.Text = message);
        }
    }

    // ───── Models ─────

    public class BrowserTab
    {
        public ChromiumWebBrowser Browser { get; set; } = null!;
        public string Title { get; set; } = "New Tab";
        public string Url { get; set; } = "";
    }

    public class Bookmark
    {
        public string Title { get; set; } = "";
        public string Url { get; set; } = "";
        public DateTime AddedAt { get; set; }
    }

    // ───── CefSharp Handlers ─────

    public class NovaLifeSpanHandler : ILifeSpanHandler
    {
        private readonly MainWindow _main;

        public NovaLifeSpanHandler(MainWindow main) => _main = main;

        public bool OnBeforePopup(IWebBrowser chromiumWebBrowser, IBrowser browser,
            IFrame frame, string targetUrl, string targetFrameName,
            WindowOpenDisposition targetDisposition, bool userGesture,
            IPopupFeatures popupFeatures, IWindowInfo windowInfo,
            IBrowserSettings browserSettings, ref bool noJavascriptAccess,
            out IWebBrowser? newBrowser)
        {
            newBrowser = null;
            _main.AddNewTabFromUrl(targetUrl);
            return true;
        }

        public void OnAfterCreated(IWebBrowser chromiumWebBrowser, IBrowser browser) { }
        public bool DoClose(IWebBrowser chromiumWebBrowser, IBrowser browser) => false;
        public void OnBeforeClose(IWebBrowser chromiumWebBrowser, IBrowser browser) { }
    }

    public class NovaDownloadHandler : IDownloadHandler
    {
        private readonly MainWindow _main;

        public NovaDownloadHandler(MainWindow main) => _main = main;

        public bool CanDownload(IWebBrowser chromiumWebBrowser, IBrowser browser,
            string url, string requestMethod) => true;

        public bool OnBeforeDownload(IWebBrowser chromiumWebBrowser, IBrowser browser,
            DownloadItem downloadItem, IBeforeDownloadCallback callback)
        {
            if (!callback.IsDisposed)
            {
                callback.Continue(
                    Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                        "Downloads", downloadItem.SuggestedFileName),
                    showDialog: true);
            }

            _main.UpdateStatus($"Downloading: {downloadItem.SuggestedFileName}");
            return false;
        }

        public void OnDownloadUpdated(IWebBrowser chromiumWebBrowser, IBrowser browser,
            DownloadItem downloadItem, IDownloadItemCallback callback)
        {
            if (downloadItem.IsComplete)
                _main.UpdateStatus($"Download complete: {downloadItem.SuggestedFileName}");
            else if (downloadItem.IsInProgress)
                _main.UpdateStatus(
                    $"Downloading {downloadItem.SuggestedFileName}: {downloadItem.PercentComplete}%");
        }
    }

    public class NovaRequestHandler : CefSharp.Handler.RequestHandler
    {
    }
}
