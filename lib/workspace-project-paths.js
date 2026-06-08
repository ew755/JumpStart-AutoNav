#!/usr/bin/env node

/**
 * workspace-project-paths.js
 * Resolve monorepo (projects/{id}) and sibling (../repo) project paths consistently.
 */

const fs = require('fs');
const path = require('path');

function toPosixRelative(fromDir, targetPath) {
  const rel = path.relative(fromDir, path.resolve(fromDir, targetPath));
  return rel.split(path.sep).join('/');
}

function getProjectRelativePath(project, projectId = null) {
  const id = projectId || project?.id || project?.project_id;
  return project?.path || (id ? `projects/${id}` : 'projects/unknown');
}

function resolveProjectRoot(rootDir, project, projectId = null) {
  const rel = getProjectRelativePath(project, projectId);
  return path.normalize(path.join(rootDir, rel));
}

function resolveProjectSpecsRoot(rootDir, project, projectId = null) {
  return path.join(resolveProjectRoot(rootDir, project, projectId), 'specs');
}

function isSiblingPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return false;
  }
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('../') || normalized.startsWith('..\\') || path.isAbsolute(relativePath);
}

function loadProjectsRegistry(rootDir) {
  const registryPath = path.join(rootDir, '.jumpstart', 'projects.json');
  if (!fs.existsSync(registryPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch {
    return null;
  }
}

function getProjectEntry(registry, projectId) {
  if (!registry?.projects) {
    return null;
  }
  return registry.projects.find((p) => (p.id || p.project_id) === projectId) || null;
}

/**
 * Find which registered project owns an absolute or relative spec path.
 * @returns {string|null} project id
 */
function findProjectBySpecPath(rootDir, specPath) {
  const registry = loadProjectsRegistry(rootDir);
  if (!registry?.projects?.length) {
    return null;
  }

  const absSpec = path.isAbsolute(specPath)
    ? path.normalize(specPath)
    : path.normalize(path.join(rootDir, specPath));

  let bestMatch = null;
  let bestLen = -1;

  for (const project of registry.projects) {
    const projectId = project.id || project.project_id;
    const specsRoot = resolveProjectSpecsRoot(rootDir, project, projectId);
    const normalizedSpecs = path.normalize(specsRoot);
    const prefix = normalizedSpecs + path.sep;

    if (absSpec === normalizedSpecs || absSpec.startsWith(prefix)) {
      if (normalizedSpecs.length > bestLen) {
        bestLen = normalizedSpecs.length;
        bestMatch = projectId;
      }
    }
  }

  return bestMatch;
}

function inferProjectIdFromMonorepoPath(specPath) {
  const match = String(specPath).replace(/\\/g, '/').match(/projects\/([^/]+)\/specs\//);
  return match ? match[1] : null;
}

/**
 * Infer project owner from a spec path using registry, monorepo pattern, or proj-default.
 */
function inferOwnerProjectFromSpec(specPath, rootDir = process.cwd()) {
  const fromRegistry = findProjectBySpecPath(rootDir, specPath);
  if (fromRegistry) {
    return fromRegistry;
  }

  const fromMonorepo = inferProjectIdFromMonorepoPath(specPath);
  if (fromMonorepo) {
    return fromMonorepo;
  }

  const absSpec = path.isAbsolute(specPath)
    ? path.normalize(specPath)
    : path.normalize(path.join(rootDir, specPath));
  const hubSpecs = path.join(rootDir, 'specs');
  if (absSpec === hubSpecs || absSpec.startsWith(hubSpecs + path.sep)) {
    return 'proj-default';
  }

  return 'proj-default';
}

function validateProjectLayout(absProjectRoot) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(absProjectRoot)) {
    errors.push(`Project directory not found: ${absProjectRoot}`);
    return { valid: false, errors, warnings };
  }

  const configPath = path.join(absProjectRoot, '.jumpstart', 'config.yaml');
  const statePath = path.join(absProjectRoot, '.jumpstart', 'state', 'state.json');
  const specsPath = path.join(absProjectRoot, 'specs');

  if (!fs.existsSync(configPath)) {
    warnings.push('Missing .jumpstart/config.yaml');
  }
  if (!fs.existsSync(statePath)) {
    warnings.push('Missing .jumpstart/state/state.json');
  }
  if (!fs.existsSync(specsPath)) {
    warnings.push('Missing specs/ directory');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configPath,
    statePath,
    specsPath,
  };
}

function validateAllProjectPaths(rootDir, registry) {
  const projects = registry?.projects || [];
  return projects.map((project) => {
    const projectId = project.id || project.project_id;
    const rel = getProjectRelativePath(project, projectId);
    const absRoot = resolveProjectRoot(rootDir, project, projectId);
    const layout = validateProjectLayout(absRoot);

    return {
      project_id: projectId,
      name: project.name,
      path: rel,
      absolute_path: absRoot,
      external: isSiblingPath(rel),
      ...layout,
    };
  });
}

function scaffoldMinimalProject(absProjectRoot, { id, name, type = 'greenfield', approver = 'TBD' }) {
  const yaml = require('yaml');
  const dirs = [
    path.join(absProjectRoot, '.jumpstart', 'state'),
    path.join(absProjectRoot, 'specs', 'decisions'),
    path.join(absProjectRoot, 'specs', 'insights'),
    path.join(absProjectRoot, 'src'),
    path.join(absProjectRoot, 'tests'),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const statePath = path.join(absProjectRoot, '.jumpstart', 'state', 'state.json');
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          version: '1.0.0',
          current_phase: null,
          approved_artifacts: [],
          resume_context: {},
        },
        null,
        2
      )
    );
  }

  const configPath = path.join(absProjectRoot, '.jumpstart', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      yaml.stringify({
        project: { id, name, type, approver },
        workflow: { enforce_sequential_phases: true, qa_log: true },
      })
    );
  }

  return { statePath, configPath };
}

module.exports = {
  toPosixRelative,
  getProjectRelativePath,
  resolveProjectRoot,
  resolveProjectSpecsRoot,
  isSiblingPath,
  loadProjectsRegistry,
  getProjectEntry,
  findProjectBySpecPath,
  inferProjectIdFromMonorepoPath,
  inferOwnerProjectFromSpec,
  validateProjectLayout,
  validateAllProjectPaths,
  scaffoldMinimalProject,
};
