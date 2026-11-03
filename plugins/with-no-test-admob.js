// Expo config plugin: fails any *release* Android build whose merged manifest still contains Google's test AdMob
// app id (ca-app-pub-3940256099942544~...). Defence in depth behind app.config.js: it checks the artefact that is
// actually shipped, so it also catches ids that arrive via a hand-edited manifest, a dependency, or a misconfigured env.
// Debug/dev-client builds are unaffected (only process<Variant>ReleaseMainManifest tasks are checked). The check is gated at
// BUILD time, not config time: it is skipped only when EAS_BUILD_PROFILE is development or preview (which may opt in to test ids
// via app.config.js); local release builds (no EAS_BUILD_PROFILE) and every other profile always need the real ids.
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// @with-no-test-admob';

module.exports = function withNoTestAdmob(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    g += `
${MARK}
tasks.configureEach { t ->
    if (!(System.getenv('EAS_BUILD_PROFILE') in ['development', 'preview']) && t.name ==~ /process\\w*ReleaseMainManifest/) {
        t.doLast {
            def found = false
            t.outputs.files.asFileTree.files.each { f ->
                if (f.name == 'AndroidManifest.xml' && f.text.contains('ca-app-pub-3940256099942544~')) found = true
            }
            if (found) {
                throw new GradleException("with-no-test-admob: the merged release manifest contains Google's TEST AdMob app id (ca-app-pub-3940256099942544~...). Set ADMOB_ANDROID_APP_ID to your real AdMob app id.")
            }
        }
    }
}
`;
    cfg.modResults.contents = g;
    return cfg;
  });
};
