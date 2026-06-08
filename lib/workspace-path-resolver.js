#!/usr/bin/env node

/**
 * workspace-path-resolver.js
 * Remap root-level specs/src/tests paths to the active project in multi-project mode.
 */

const path = require('path');
const { getWorkspaceContext } = require('./workspace-context');

/**
 * @param {string} workspaceDir
 * @param {object} [workspaceContext] - Optional pre-loaded context from getWorkspaceContext()
 * @returns {{ enabled: boolean, resolvePath: (filePath: string) => string, specsRel: string|null, usageLogPath: string|null }}
 */
function createWorkspacePathResolver(workspaceDir, workspaceContext = null) {
  const context = workspaceContext || getWorkspaceContext(workspaceDir);
  const noop = (filePath) => filePath;

  if (context.mode !== 'multi-project' || !context.config?.specs_path) {
    return {
      enabled: false,
      resolvePath: noop,
      specsRel: null,
      usageLogPath: path.join(workspaceDir, '.jumpstart', 'usage-log.json'),
    };
  }

  const rootSpecs = path.join(workspaceDir, 'specs');
  const rootSrc = path.join(workspaceDir, 'src');
  const rootTests = path.join(workspaceDir, 'tests');
  const projectSpecs = context.config.specs_path;
  const projectSrc = context.config.src_path;
  const projectTests = context.config.tests_path;

  const projectPath = context.project?.projectPath || workspaceDir;
  const usageLogPath = path.join(projectPath, '.jumpstart', 'usage-log.json');

  function remapRootPrefix(absPath, rootPrefix, projectPrefix) {
    if (!projectPrefix || projectPrefix === rootPrefix) {
      return absPath;
    }
    const normalizedRoot = path.normalize(rootPrefix);
    const normalizedAbs = path.normalize(absPath);
    if (normalizedAbs === normalizedRoot) {
      return projectPrefix;
    }
    const rootWithSep = normalizedRoot + path.sep;
    if (normalizedAbs.startsWith(rootWithSep)) {
      const suffix = path.relative(normalizedRoot, normalizedAbs);
      return path.join(projectPrefix, suffix);
    }
    return absPath;
  }

  function resolvePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return filePath;
    }

    let abs = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.normalize(path.join(workspaceDir, filePath));

    abs = remapRootPrefix(abs, rootSpecs, projectSpecs);
    abs = remapRootPrefix(abs, rootSrc, projectSrc);
    abs = remapRootPrefix(abs, rootTests, projectTests);

    return abs;
  }

  const specsRel = path.relative(workspaceDir, projectSpecs).replace(/\\/g, '/');

  return {
    enabled: true,
    resolvePath,
    specsRel,
    usageLogPath,
    projectSpecs,
  };
}

module.exports = {
  createWorkspacePathResolver,
};
