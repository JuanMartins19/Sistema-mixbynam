import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function check(url: string, key: string) {
  return spawnSync(process.execPath, ['scripts/check-netlify-env.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL:url, NEXT_PUBLIC_SUPABASE_ANON_KEY:key },
  });
}
function jwt(role: string) {
  return ['header', Buffer.from(JSON.stringify({role})).toString('base64url'), 'test-signature'].join('.');
}

test('publicação exige as duas configurações mesmo com .env.local no computador', () => {
  for (const [url,key,missing] of [
    ['', 'sb_publishable_test', 'NEXT_PUBLIC_SUPABASE_URL'],
    ['https://example.supabase.co', '', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  ]) {
    const result = check(url,key);
    assert.equal(result.status,1);
    assert.match(result.stderr,new RegExp(missing));
  }
});

test('publicação rejeita exemplos e URL sem HTTPS', () => {
  for (const [url,key] of [
    ['https://SEU-PROJETO.supabase.co','SUA-CHAVE-PUBLICA'],
    ['http://example.supabase.co','sb_publishable_test'],
  ]) assert.equal(check(url,key).status,1);
});

test('publicação aceita chaves anon e publishable', () => {
  for (const key of [jwt('anon'),'sb_publishable_test']) {
    assert.equal(check('https://example.supabase.co',key).status,0);
  }
});

test('publicação rejeita chave privilegiada sem expor seu valor nos logs', () => {
  for (const key of [jwt('service_role'),'sb_secret_value_that_must_not_be_logged']) {
    const result = check('https://example.supabase.co',key);
    assert.equal(result.status,1);
    assert.ok(!(result.stdout+result.stderr).includes(key));
  }
});
