const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Packages that must be singletons — only one copy may exist in the bundle.
// In a pnpm monorepo, Metro can follow symlinks into workspace libs and pick
// up a different peer-resolved copy (e.g. react-query built against react@19.1
// vs react@19.2), breaking context-based APIs like QueryClientProvider.
const SINGLETONS = [
  "@tanstack/react-query",
  "@tanstack/query-core",
  "react",
  "react-dom",
];

config.resolver = config.resolver ?? {};

// 1. extraNodeModules — handles top-level import resolution.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...Object.fromEntries(
    SINGLETONS.map((pkg) => [
      pkg,
      path.resolve(__dirname, "node_modules", pkg),
    ])
  ),
};

// 2. resolveRequest — intercepts ALL imports of these packages regardless of
//    where in the dependency tree they originate (including workspace libs like
//    @workspace/api-client-react). Forces every import to resolve from this
//    app's own node_modules, ensuring a single module instance.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const pkg of SINGLETONS) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      try {
        const filePath = require.resolve(moduleName, { paths: [__dirname] });
        return { filePath, type: "sourceFile" };
      } catch {
        // Package not found locally — fall through to default resolution.
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Block Metro from watching pnpm temp extraction dirs (_tmp_\d+) and Vite
// deps_temp dirs (created transiently during Vite builds) which are deleted
// immediately after, causing ENOENT errors in Metro's FallbackWatcher.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  /node_modules\/\.pnpm\/.*_tmp_\d+/,
  /node_modules\/\.vite\/deps_temp_.*/,
  /artifacts\/admin\/.*/,
  /artifacts\/mockup-sandbox\/.*/,
];

module.exports = config;
