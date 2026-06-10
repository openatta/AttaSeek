/**
 * Plain-JS mock window.api for Playwright addInitScript injection.
 *
 * This is the compiled-to-JS version of mock-api.ts — injected before React
 * mounts so that the renderer finds window.api immediately.
 *
 * Call window.__mockReset__() between tests to start fresh.
 * Call window.__mockSetScenarios__(scenarios) to queue event sequences for
 * agent interactions (each scenario is an array of SessionEvent objects).
 */

(function() {
  'use strict';

  var sessions = [];
  var events = {};
  var tasks = [];
  var modelConfigs = [];
  var eventListeners = [];
  var sessionUpdateListeners = [];
  var currentScenarios = [];
  var scenarioIndex = 0;
  var _idCounter = 0;
  var _activeTaskId = null;
  var _activeSessionId = null;

  function newId() {
    return 'mock_' + Date.now() + '_' + (++_idCounter);
  }

  function runNextScenario(taskId, sessionId) {
    if (scenarioIndex >= currentScenarios.length) {
      // No scenario → emit synthetic completion
      emitTaskCompleted(taskId, sessionId);
      return;
    }
    var scenarioEvents = currentScenarios[scenarioIndex++];
    if (!scenarioEvents) {
      emitTaskCompleted(taskId, sessionId);
      return;
    }

    var delay = 0;
    scenarioEvents.forEach(function(evt) {
      setTimeout(function() {
        evt.id = evt.id || newId();
        evt.createdAt = evt.createdAt || Date.now();
        // Replace placeholder task ID with the actual one
        if (evt.taskId === '<task>') evt.taskId = taskId;
        // Replace placeholder session ID
        if (evt.sessionId === '<session>') evt.sessionId = sessionId;
        if (!events[evt.sessionId]) events[evt.sessionId] = [];
        events[evt.sessionId].push(evt);
        eventListeners.forEach(function(cb) {
          try { cb(evt); } catch(e) { console.warn('[mock-api] listener error:', e); }
        });
      }, delay);
      delay += 80;
    });

    // After all scenario events, emit TaskCompleted with the real task ID
    setTimeout(function() {
      emitTaskCompleted(taskId, sessionId);
    }, delay + 50);
  }

  function emitTaskCompleted(taskId, sessionId) {
    if (!taskId) return;
    var sid = sessionId || _activeSessionId || 'unknown';
    var evt = {
      id: newId(),
      sessionId: sid,
      taskId: taskId,
      type: 'TaskCompleted',
      payload: { summary: 'Task completed' },
      createdAt: Date.now(),
    };
    if (!events[sid]) events[sid] = [];
    events[sid].push(evt);
    eventListeners.forEach(function(cb) {
      try { cb(evt); } catch(e) {}
    });
  }

  window.__mockReset__ = function() {
    sessions = [];
    events = {};
    tasks = [];
    modelConfigs = [{
      id: 'mock-model-1',
      name: 'Mock Model',
      interfaceType: 'openai_compatible',
      endpointUrl: 'http://localhost:19999/v1',
      models: ['mock-model'],
      defaultModel: 'mock-model',
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }];
    eventListeners = [];
    sessionUpdateListeners = [];
    currentScenarios = [];
    scenarioIndex = 0;
    _idCounter = 0;
    window.__mockProjects__ = [];
    window.__mockTerminalListeners__ = [];
  };

  window.__mockEmitEvent__ = function(evt) {
    if (!events[evt.sessionId]) events[evt.sessionId] = [];
    events[evt.sessionId].push(evt);
    eventListeners.forEach(function(cb) {
      try { cb(evt); } catch(e) {}
    });
  };

  window.__mockGetEvents__ = function() {
    var all = [];
    Object.keys(events).forEach(function(k) {
      all = all.concat(events[k]);
    });
    return all;
  };

  window.__mockSetScenarios__ = function(scenarios) {
    currentScenarios = scenarios;
    scenarioIndex = 0;
  };

  window.__mockAddSession__ = function(session) {
    sessions.unshift(session);
    return session;
  };

  window.__mockGetSessions__ = function() {
    return sessions.slice();
  };

  window.__mockGetTasks__ = function() {
    return tasks.slice();
  };

  // ── window.api ──

  window.api = {
    platform: 'darwin',
    isMac: true,
    isWindows: false,
    isLinux: false,

    theme: {
      get: function() { return Promise.resolve({ theme: 'dark' }); },
      set: function(_t) { return Promise.resolve({ success: true }); },
      onSystemChange: function(_cb) { return function() {}; }
    },

    agent: {
      createTask: function(goal, sessionId, _projectId, _modelConfigId, _modelName, _language) {
        var task = {
          id: newId(),
          sessionId: sessionId,
          goal: goal,
          status: 'executing',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        tasks.push(task);

        // Store for scenario completion
        _activeTaskId = task.id;
        _activeSessionId = sessionId;

        // Auto-create session
        if (!sessions.some(function(s) { return s.id === sessionId; })) {
          var session = {
            id: sessionId,
            title: goal.slice(0, 60),
            activity: 'chat',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          sessions.unshift(session);
          sessionUpdateListeners.forEach(function(cb) {
            try { cb({ id: session.id, title: session.title }); } catch(e) {}
          });
        }

        if (!events[sessionId]) events[sessionId] = [];

        // Emit UserMessage (with real task ID)
        var userEvt = {
          id: newId(),
          sessionId: sessionId,
          taskId: task.id,
          type: 'UserMessage',
          payload: { content: goal },
          createdAt: Date.now(),
        };
        events[sessionId].push(userEvt);
        eventListeners.forEach(function(cb) { try { cb(userEvt); } catch(e) {} });

        // Run scenarios — they receive the real taskId for placeholder replacement
        runNextScenario(task.id, sessionId);

        return Promise.resolve({ success: true, task: task });
      },

      cancelTask: function(taskId) {
        var t = tasks.find(function(t) { return t.id === taskId; });
        if (t) { t.status = 'cancelled'; t.updatedAt = Date.now(); }
        return Promise.resolve({ success: true });
      },

      getTask: function(taskId) {
        return Promise.resolve({ task: tasks.find(function(t) { return t.id === taskId; }) || null });
      },

      listEvents: function(sessionId) {
        return Promise.resolve({ events: events[sessionId] || [] });
      },

      onEvent: function(cb) {
        eventListeners.push(cb);
        return function() {
          eventListeners = eventListeners.filter(function(l) { return l !== cb; });
        };
      }
    },

    artifact: {
      list: function(_sid) { return Promise.resolve({ artifacts: [] }); },
      get: function(_id) { return Promise.resolve({ artifact: null }); },
      update: function(_id, _p) { return Promise.resolve({ artifact: null }); }
    },

    skill: {
      list: function() { return Promise.resolve({ skills: [] }); }
    },

    tool: {
      list: function() { return Promise.resolve({ tools: [] }); }
    },

    permission: {
      respond: function(_rid, _d) { return Promise.resolve({ success: true }); },
      listPolicies: function() { return Promise.resolve({ policies: [] }); },
      updatePolicy: function(_id, _d) { return Promise.resolve({ success: true }); }
    },

    memory: {
      list: function(_f) { return Promise.resolve({ entries: [] }); },
      store: function(_e) { return Promise.resolve({ entry: {} }); },
      delete: function(_id) { return Promise.resolve({ success: true }); }
    },

    audit: {
      list: function(_f) { return Promise.resolve({ logs: [] }); }
    },

    model: {
      list: function() { return Promise.resolve({ configs: modelConfigs }); },
      create: function(config) {
        var c = Object.assign({}, config, { id: newId(), createdAt: Date.now(), updatedAt: Date.now(), isDefault: modelConfigs.length === 0 });
        modelConfigs.push(c);
        return Promise.resolve({ config: c });
      },
      get: function(id) {
        return Promise.resolve({ config: modelConfigs.find(function(c) { return c.id === id; }) || null });
      },
      update: function(id, patch) {
        var c = modelConfigs.find(function(c) { return c.id === id; });
        if (c) { Object.assign(c, patch); c.updatedAt = Date.now(); }
        return Promise.resolve({ config: c || null });
      },
      delete: function(id) {
        modelConfigs = modelConfigs.filter(function(c) { return c.id !== id; });
        return Promise.resolve({ success: true });
      },
      setDefault: function(id) {
        modelConfigs.forEach(function(c) { c.isDefault = c.id === id; });
        return Promise.resolve({ success: true });
      },
      test: function(_id) { return Promise.resolve({ success: true }); },
      usage: function(_cid, _days) { return Promise.resolve({ stats: {} }); },
      hasConfig: function() { return Promise.resolve({ configured: modelConfigs.length > 0 }); }
    },

    session: {
      create: function(title, activity, id, projectId) {
        var s = {
          id: id || newId(),
          title: title || 'New Session',
          activity: activity || 'chat',
          projectId: projectId || null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        sessions.unshift(s);
        return Promise.resolve({ session: s });
      },
      list: function(activity, projectId) {
        var filtered = sessions;
        if (activity) filtered = filtered.filter(function(s) { return s.activity === activity; });
        if (projectId !== undefined) filtered = filtered.filter(function(s) { return s.projectId === projectId; });
        return Promise.resolve({ sessions: filtered });
      },
      get: function(id) {
        return Promise.resolve({ session: sessions.find(function(s) { return s.id === id; }) || null });
      },
      update: function(id, patch) {
        var s = sessions.find(function(s) { return s.id === id; });
        if (s) {
          if (patch.title) s.title = patch.title;
          s.updatedAt = Date.now();
          sessionUpdateListeners.forEach(function(cb) {
            try { cb({ id: id, title: s.title }); } catch(e) {}
          });
        }
        return Promise.resolve({ session: s || null });
      },
      delete: function(id) {
        sessions = sessions.filter(function(s) { return s.id !== id; });
        delete events[id];
        return Promise.resolve({ success: true });
      },
      onUpdate: function(cb) {
        sessionUpdateListeners.push(cb);
        return function() {
          sessionUpdateListeners = sessionUpdateListeners.filter(function(l) { return l !== cb; });
        };
      }
    },

    plugin: {
      list: function() { return Promise.resolve({ plugins: [] }); }
    },

    question: {
      respond: function(_qid, _a) { return Promise.resolve({ success: true }); }
    },

    app: {
      getState: function(_k) { return Promise.resolve({ success: false, value: null }); },
      setState: function(_k, _v) { return Promise.resolve({ success: true }); }
    },

    // ── Filesystem API ──
    fs: {
      readDir: function(dirPath) {
        // Normalize path — strip trailing slash if present
        var dir = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
        var entries = (window.__mockFsEntries__ || []).filter(function(e) {
          // Entry must be under this directory (not the directory itself)
          if (e.path === dir || !e.path.startsWith(dir + '/')) return false;
          // Entry must be a DIRECT child (no intermediate slashes after dir/)
          var rest = e.path.slice(dir.length + 1);
          return rest.indexOf('/') === -1;
        });
        return Promise.resolve({ success: true, entries: entries });
      },
      readFile: function(filePath) {
        var files = window.__mockFsFiles__ || {};
        var f = files[filePath];
        if (f) return Promise.resolve({ success: true, content: f.content, size: f.size, mime: f.mime });
        return Promise.resolve({ success: false, error: 'File not found: ' + filePath });
      },
      fileInfo: function(filePath) {
        var files = window.__mockFsFiles__ || {};
        var f = files[filePath];
        if (f) return Promise.resolve({ success: true, exists: true, size: f.size, mime: f.mime, isDir: false });
        var entries = window.__mockFsEntries__ || [];
        var dir = entries.find(function(e) { return e.path === filePath && e.isDir; });
        if (dir) return Promise.resolve({ success: true, exists: true, size: 0, isDir: true });
        return Promise.resolve({ success: true, exists: false, size: 0, isDir: false });
      },
      createFile: function(filePath, content) {
        var files = window.__mockFsFiles__ || {};
        files[filePath] = { content: content || '', size: (content || '').length, mime: 'text/plain' };
        window.__mockFsFiles__ = files;
        return Promise.resolve({ success: true });
      },
      createDir: function(_dirPath) {
        return Promise.resolve({ success: true });
      },
      delete: function(_path, _recursive) {
        return Promise.resolve({ success: true });
      },
      rename: function(_oldP, _newP) {
        return Promise.resolve({ success: true });
      },
      addRoot: function(_rootPath) {
        return Promise.resolve({ success: true });
      },
      removeRoot: function(_rootPath) {
        return Promise.resolve({ success: true });
      }
    },

    // ── Git API ──
    git: {
      status: function(repoPath) {
        var git = window.__mockGitData__ || {};
        if (!git.branch) {
          return Promise.resolve({ success: false, error: 'Not a git repository' });
        }
        return Promise.resolve({
          success: true,
          branch: git.branch,
          changedFiles: git.changedFiles || []
        });
      },
      branches: function(_repoPath) {
        var git = window.__mockGitData__ || {};
        return Promise.resolve({ success: true, branches: git.branches || [], current: git.branch || '' });
      },
      diff: function(_repoPath, _scope, _staged) {
        var git = window.__mockGitData__ || {};
        return Promise.resolve({ success: true, files: git.diffFiles || [] });
      },
      stage: function(_repoPath, _files) {
        return Promise.resolve({ success: true });
      },
      unstage: function(_repoPath, _files) {
        return Promise.resolve({ success: true });
      },
      revert: function(_repoPath, _files) {
        return Promise.resolve({ success: true });
      },
      commit: function(_repoPath, _message) {
        return Promise.resolve({ success: true, commitHash: 'abc1234' + '0'.repeat(33) });
      },
      log: function(_repoPath, _maxCount) {
        var git = window.__mockGitData__ || {};
        return Promise.resolve({ success: true, commits: git.commits || [] });
      },
      show: function(_repoPath, _ref) {
        return Promise.resolve({
          success: true,
          diff: 'diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -29,3 +29,4 @@\n     </div>\n   );\n }\n+// TODO: add more features'
        });
      }
    },

    // ── Terminal API ──
    terminal: {
      create: function(_cwd, _cols, _rows) {
        var tid = 'mock-term-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        var terms = window.__mockTerminals__ || [];
        terms.push(tid);
        window.__mockTerminals__ = terms;
        // Emit a welcome line
        setTimeout(function() {
          (window.__mockTerminalListeners__ || []).forEach(function(cb) {
            try { cb({ terminalId: tid, data: 'Welcome to AttaSeek Terminal\r\n$ ' }); } catch(e) {}
          });
        }, 100);
        return Promise.resolve({ success: true, terminalId: tid });
      },
      write: function(_terminalId, _data) {
        return Promise.resolve({ success: true });
      },
      resize: function(_terminalId, _cols, _rows) {
        return Promise.resolve({ success: true });
      },
      destroy: function(_terminalId) {
        return Promise.resolve({ success: true });
      },
      onOutput: function(cb) {
        if (!window.__mockTerminalListeners__) window.__mockTerminalListeners__ = [];
        window.__mockTerminalListeners__.push(cb);
        return function() {
          window.__mockTerminalListeners__ = (window.__mockTerminalListeners__ || []).filter(function(l) { return l !== cb; });
        };
      }
    },

    // ── Project API ──
    project: {
      create: function(name, rootPath) {
        var projects = window.__mockProjects__ || [];
        if (projects.some(function(p) { return p.rootPath === rootPath; })) {
          return Promise.resolve({ success: false, error: 'Duplicate root path' });
        }
        var project = {
          id: 'proj_' + Date.now().toString(36),
          name: name,
          rootPath: rootPath,
          createdAt: Date.now(),
        };
        projects.push(project);
        window.__mockProjects__ = projects;
        return Promise.resolve({ success: true, project: project });
      },
      list: function() {
        return Promise.resolve({ success: true, projects: window.__mockProjects__ || [] });
      },
      remove: function(projectId) {
        var projects = (window.__mockProjects__ || []).filter(function(p) { return p.id !== projectId; });
        window.__mockProjects__ = projects;
        return Promise.resolve({ success: true, deletedSessions: 0 });
      },
      validate: function(_rootPath) {
        return Promise.resolve({ success: true, valid: true, exists: true, writable: true });
      }
    }
  };

  // ── window.__mockSet* helpers for test data injection ──

  window.__mockSetFsData__ = function(entries, files) {
    window.__mockFsEntries__ = entries;
    window.__mockFsFiles__ = files || {};
  };

  window.__mockSetGitData__ = function(data) {
    window.__mockGitData__ = data;
  };

  window.__mockSetNoGit__ = function() {
    window.__mockGitData__ = {};
  };

  window.__mockTerminalListeners__ = [];

  // Initialize default FS data with empty project
  window.__mockFsEntries__ = [];
  window.__mockFsFiles__ = {};
  window.__mockGitData__ = {};
})();
