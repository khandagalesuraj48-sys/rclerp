/* THE APP'S LANGUAGE (update-110): every English text the page can show – its markup, the texts its script writes, the server's
 * messages – collected into app/i18n/keys.json. The translations are app/i18n/mr.json and app/i18n/hi.json (English → Marathi /
 * Hindi; a text with {0}, {1}… is a pattern: the parts in braces are what the page fills in – a machinery, a date, a number).
 * Run again after texts were added:   node tools/i18n/extract.js      (needs acorn: npm i --no-save acorn acorn-walk)
 * It prints how many texts have no translation yet; the unit test (update-110) checks the translations. Nothing of the app is changed. */
'use strict';
const fs = require('fs'), path = require('path');
const need = n => { try { return require(n); } catch (e) { return require(path.join('/opt/node-tools/node_modules', n)); } };
const acorn = need('acorn'), walk = need('acorn-walk');
const APP = path.join(__dirname, '..', '..', 'app'), PH = '\u0001';
const keys = new Map();
const deva = /[ऀ-ॿ]/;
function text(t) {
  if (!/[A-Za-z]{2,}/.test(t.replace(/\{\d+\}/g, '')) || deva.test(t) || t.length > 1200) return false;
  if (/^\[|data-[a-z]|="|='|<\/?[a-z]|^[#.][\w-]|^\/[\w/]|^https?:|[{;]\s*$|=>|\bfunction\b|\bvar\(--|\bpx\b|^\w+\(|\\[nrtd]|^\^|\$$|^[\w-]+:[\w-]+$|^[A-Z0-9_]{3,}$|^[a-z]+[A-Z]\w*$|^[\w.-]+\.(png|jpe?g|js|css|json|html|xlsx|pdf|svg)$/.test(t)) return false;
  if (/^[a-z_][a-z0-9_]*$/.test(t) && t.length > 1 && /_/.test(t)) return false;      // an identifier
  if (/^[^ ]*[_/][^ ]*$/.test(t) && !/^\w+\/\w+$/.test(t)) return false;              // a path / an id
  return true;
}
function add(raw) {
  String(raw).split(/<[^>]*>/).forEach(seg => {
    seg = seg.replace(/^[^<>]*?["']\s*\/?>/, '');      // the end of a tag that began in a part the page fills in (… + '_fx">Fixed rate')
    seg = seg.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
    let n = 0; const t = seg.replace(/\s+/g, ' ').trim().replace(/\u0001+/g, () => '{' + (n++) + '}');
    if (/^(\{\d+\}\s*)+$/.test(t) || !text(t)) return;
    keys.set(t, (keys.get(t) || 0) + 1);
  });
}
function js(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true });
  const used = new Set();
  const flat = n => n.type === 'BinaryExpression' && n.operator === '+' ? flat(n.left).concat(flat(n.right)) : [n];
  // texts that are already in three languages ({ en, mr, hi }) are left as they are
  const inLangs = anc => anc.slice(-5).some(a => a.type === 'Property' && /^(en|mr|hi)$/.test((a.key && (a.key.name || a.key.value)) || ''));
  walk.fullAncestor(ast, (node, st, anc) => {
    const parent = anc[anc.length - 2];
    if (inLangs(anc)) return;
    if (node.type === 'BinaryExpression' && node.operator === '+' && !(parent && parent.type === 'BinaryExpression' && parent.operator === '+')) {
      const parts = flat(node); if (!parts.some(p => p.type === 'Literal' && typeof p.value === 'string')) return;
      parts.forEach(p => used.add(p));
      add(parts.map(p => p.type === 'Literal' && typeof p.value === 'string' ? p.value : PH).join(''));
    } else if (node.type === 'TemplateLiteral') add(node.quasis.map(q => q.value.cooked).join(PH));
    else if (node.type === 'Literal' && typeof node.value === 'string' && !used.has(node)) {
      if (parent && parent.type === 'Property' && parent.key === node) return;
      if (parent && parent.type === 'MemberExpression' && parent.property === node) return;
      add(node.value);
    }
  });
}
const app = fs.readFileSync(path.join(APP, 'App.html'), 'utf8');
const html = app.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
add(html);
[...html.matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)].forEach(m => add(m[1]));
[...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m => js(m[1]));
['Code.gs', 'Sites.gs'].forEach(f => js(fs.readFileSync(path.join(APP, f), 'utf8')));
const list = [...keys.keys()].sort((a, b) => a.localeCompare(b));
fs.mkdirSync(path.join(APP, 'i18n'), { recursive: true });
fs.writeFileSync(path.join(APP, 'i18n', 'keys.json'), JSON.stringify(list, null, 0).replace(/","/g, '",\n"') + '\n');
const words = list.reduce((a, k) => a + k.split(/\s+/).length, 0);
const missing = l => { let d = {}; try { d = JSON.parse(fs.readFileSync(path.join(APP, 'i18n', l + '.json'), 'utf8')); } catch (e) { d = {}; } return list.filter(k => !(k in d)).length; };
console.log(list.length + ' texts (' + words + ' words) → app/i18n/keys.json · not translated yet: mr ' + missing('mr') + ', hi ' + missing('hi'));
