#!/usr/bin/env node
/* Writes converter/ingredient-names.md from the dictionary in core.js.

     node tools/generate-ingredient-names.js           write the file
     node tools/generate-ingredient-names.js --check   exit 1 if it is out of date

   The dictionary's master copy is INGREDIENT_DICTIONARY in core.js (since
   25 Sep 2026, PR 6a). The .md is what a person reads and what the validators
   parse, so it is generated rather than edited: edit core.js, run this, commit
   both. test/core.test.js runs --check, and CI runs that, so the two cannot
   drift. The prose at the top of the file lives here, below. */
const fs = require('fs');
const path = require('path');
const { INGREDIENT_AISLES, INGREDIENT_DICTIONARY } = require('../core.js');

const OUT = path.join(__dirname, '..', 'converter', 'ingredient-names.md');
const PREAMBLE = fs.readFileSync(path.join(__dirname, 'ingredient-names-preamble.md'), 'utf8');

/* An empty cell is written "| |", the way the file was written by hand. */
const row = cells => '|' + cells.map(c => c ? ' ' + c + ' ' : ' ').join('|') + '|';

function render(){
  const out = [PREAMBLE];
  INGREDIENT_AISLES.forEach((aisle, i) => {
    const rows = INGREDIENT_DICTIONARY.filter(r => r.aisle === aisle);
    const three = rows.some(r => r.countAs !== undefined);
    const head = three ? ['Write', 'Also written as', 'Count as'] : ['Write', 'Also written as'];
    out.push('## ' + aisle, '', row(head), row(head.map(() => '---')));
    rows.forEach(r => out.push(row(three ? [r.name, r.also, r.countAs || ''] : [r.name, r.also])));
    out.push('');
  });
  return out.join('\n');
}

const text = render();
if(process.argv.includes('--check')){
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if(current !== text){
    console.error('converter/ingredient-names.md is out of date with core.js: run node tools/generate-ingredient-names.js');
    process.exit(1);
  }
  console.log('converter/ingredient-names.md matches core.js');
} else {
  fs.writeFileSync(OUT, text);
  console.log('wrote', OUT, INGREDIENT_DICTIONARY.length, 'rows');
}
module.exports = { render };
