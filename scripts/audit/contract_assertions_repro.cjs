#!/usr/bin/env node
'use strict';
// Static TypeScript AST count and isolated synthetic Jest demonstration.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
if(process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/contract_assertions_repro.cjs\nBroji it/test slučajeve i expect pozive unutar if grana u postojećoj contract suite; u privremenom direktoriju izolovani Jest dokazuje da uslovne asertacije mogu proći na sintetičkom 404. Ne izvršava originalni AppModule, bazu, mrežu ili proizvodni kod.');process.exit(0);
}
if(process.argv.length!==2){console.error('Nepoznat argument; koristite --help');process.exit(2);}
const root=path.resolve(__dirname,'../..');
const ts=require(path.join(root,'backend/node_modules/typescript'));
const source=fs.readFileSync(path.join(root,'backend/test/contract/api-contract.spec.ts'),'utf8');
const ast=ts.createSourceFile('contract.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let total=0,conditionalOnly=0,noExpect=0;
function visit(node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['it','test'].includes(node.expression.text)&&node.arguments.length>=2){
    const callback=node.arguments[1];
    if(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback)){
      total++;let all=0,conditional=0;
      function walk(n,depth){
        const nested=depth+(ts.isIfStatement(n)?1:0);
        if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='expect'){all++;if(nested)conditional++;}
        ts.forEachChild(n,c=>walk(c,nested));
      }
      walk(callback.body,0);
      if(!all)noExpect++;else if(all===conditional)conditionalOnly++;
    }
  }
  ts.forEachChild(node,visit);
}
visit(ast);
let tmp;
try{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'contract-audit-'));
  const testPath=path.join(tmp,'contract-demo.test.js');
  const resultPath=path.join(tmp,'result.json');
  fs.writeFileSync(testPath,"test('conditional', () => { const response = {status: 404}; if (response.status === 200) expect(response.status).toBe(200); });\ntest('required status', () => { const response = {status: 404}; expect(response.status).toBe(200); });\n");
  const result=cp.spawnSync(process.execPath,[path.join(root,'backend/node_modules/jest/bin/jest.js'),'--runInBand','--json','--outputFile',resultPath,'--config',JSON.stringify({rootDir:tmp,testEnvironment:'node'}),testPath],{encoding:'utf8',timeout:30000});
  assert.equal(result.status,1);
  const report=JSON.parse(fs.readFileSync(resultPath,'utf8'));
  const outcomes=Object.fromEntries(report.testResults[0].assertionResults.map(x=>[x.title,x.status]));
  assert.equal(outcomes.conditional,'passed');assert.equal(outcomes['required status'],'failed');
  console.log(JSON.stringify({scope:'static AST of contract suite; separate synthetic Jest, not original HTTP suite',staticTestCases:total,allExpectCallsInsideSomeIf:conditionalOnly,zeroExpectCalls:noExpect,synthetic404ConditionalCase:outcomes.conditional,synthetic404RequiredStatusCase:outcomes['required status'],originalSuiteOrDatabaseRun:false,note:'AST classification is syntactic, not proof all conditions are reachable; neither assertions hidden in helpers nor non-if control flow are analysed.'},null,2));
}catch{console.error('Provjera nije uspjela; provjerite lokalne zavisnosti i dozvolu za privremeni direktorij.');process.exitCode=1;}
finally{if(tmp)fs.rmSync(tmp,{recursive:true,force:true});}
