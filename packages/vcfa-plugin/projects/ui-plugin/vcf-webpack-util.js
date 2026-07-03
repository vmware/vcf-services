const { shareAll } = require('@angular-architects/module-federation/webpack');

/**
 * Construct list of npm dependencies to be loaded from VCFA.
 * 
 * It's okay UI Plugin to use versions less than the supported,
 * this statement lies on the rule:
 * "If you compile Angular library with angular 19.0.0 it can be installed and used in projects running 19.MINOR.PATCH"
 * 
 * To follow the rule when we for-each the list of libraries we set
 * requiredVersion to be `^${record[npmPackageName].requiredVersion`,
 * where `^` means any MAJOR version will suffice in runtime.
 */
function prepare() {
  const allRecords = shareAll({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
  });

  const coreLibs = [
    "@angular",
    "@clr",
    "rxjs",
    "@vcfa/container-hooks"
  ];

  const libsToShare = Object.keys(allRecords).map((npmPackageName) => {
    const itIsCoreLib = !!coreLibs.find((coreLibName) => {
      return npmPackageName.startsWith(coreLibName);
    });

    if (itIsCoreLib) {
      return {
        [npmPackageName]: allRecords[npmPackageName]
      };
    }

    return null;
  })
  .filter(Boolean)
  .map((record) => {
    Object.keys(record).forEach((npmPackageName) => {
      if (record[npmPackageName].requiredVersion.startsWith("^")) {
        return;
      }

      if (record[npmPackageName].requiredVersion.startsWith("~")) {
        return;
      }

      record[npmPackageName].requiredVersion = `^${record[npmPackageName].requiredVersion}`;
    });
    
    return record;
  });

  const coreSharedLibs = {};
  libsToShare.forEach((record) => {
    Object.assign(coreSharedLibs, record);
  });

  return coreSharedLibs;
}

module.exports = { prepare };
