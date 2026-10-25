// Worker-time hook for the review-managed skills: runs worktime.js --hook from the project's .claude, else the global one.
// Plain node (no bash): from Cursor's PowerShell, `bash` is WSL bash with its own node and /tmp.
const fs = require('fs'), path = require('path'), os = require('os');
const local = path.resolve('.claude/skills/review-managed/worktime.js');
const f = fs.existsSync(local) ? local
  : path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'skills', 'review-managed', 'worktime.js');
if (!fs.existsSync(f)) { console.log('{}'); process.exit(0); }   // skills not installed: never block the agent
process.argv = [process.argv[0], f, '--hook'];
require(f);
