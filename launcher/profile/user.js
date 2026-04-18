// Nova — Firefox preferences applied to the Nova profile on every launch.
//
// We lock this profile to Nova branding: custom homepage/new-tab, enabled
// legacy chrome stylesheets (so userChrome.css / userContent.css are picked
// up), and a handful of quality-of-life defaults.

// Enable userChrome.css and userContent.css
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// New-tab and homepage both point at the bundled Nova page inside the profile
// directory. Firefox loads it as file:/// which is enough for a static page.
user_pref("browser.startup.homepage", "%NEWTAB_URL%");
user_pref("browser.startup.page", 1);
user_pref("browser.newtabpage.enabled", false);

// Hide Firefox onboarding + default-browser prompts + "what's new" tabs.
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("doh-rollout.doneFirstRun", true);
user_pref("trailhead.firstrun.didSeeAboutWelcome", true);

// No data reporting / telemetry popups — Nova should feel quiet.
user_pref("datareporting.policy.firstRunURL", "");
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry", false);

// Faster feel.
user_pref("browser.tabs.animate", true);
user_pref("browser.display.use_system_colors", false);
user_pref("layers.acceleration.force-enabled", true);

// Branding.
user_pref("general.useragent.locale", "en-US");
user_pref("intl.locale.requested", "en-US");

// Keep the title bar visible so users can see Nova branding.
user_pref("browser.tabs.inTitlebar", 0);
