// Generates a NEW migration from local, versioned metadata; no phone data/network.
const fs=require('node:fs');
const metadata=require('libphonenumber-js/metadata.min.json');
const version=require('libphonenumber-js/package.json').version;
const plans=new Map();
for(const plan of [...Object.values(metadata.countries),...Object.values(metadata.nonGeographic)]){
  const code=plan[0];if(!plans.has(code))plans.set(code,new Set());for(const size of plan[3])if(size>0)plans.get(code).add(size);
}
// +1 needs the area code; regional seven-digit dialing is not international.
plans.set('1',new Set([10]));
const tuples=[...plans].sort(([a],[b])=>Number(a)-Number(b)).map(([code,lengths])=>`('${code}',array[${[...lengths].sort((a,b)=>a-b).join(',')}])`).join(',\n');
const clientLimits=Object.fromEntries([...plans].map(([code,lengths])=>[code,Math.min(15,code.length+Math.max(...lengths))]));
if(process.argv.includes('--client-only')){
  fs.writeFileSync('src/lib/phone-limits.json',JSON.stringify(clientLimits,null,2)+'\n','utf8');
  console.log('Generated local phone digit limits.');process.exit(0);
}
const ddds='11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99';
const prior=fs.readFileSync('supabase/migrations/008_submission_privacy.sql','utf8');
const start=prior.indexOf('create or replace function private.validate_stage');
const end=prior.indexOf('create or replace function public.resume_project');
const validator=prior.slice(start,end).replace("a->>'whatsapp' !~ '^[0-9]{10,15}$'","not private.valid_whatsapp(a->>'whatsapp')");
const sql=`-- Apply after 008. Country length metadata: libphonenumber-js ${version}.
-- Validate format/length only; does not prove ownership or a WhatsApp account.
begin;
create table private.phone_lengths(country_code text primary key,possible_lengths integer[] not null);
alter table private.phone_lengths enable row level security;
revoke all on private.phone_lengths from public,anon,authenticated;
insert into private.phone_lengths(country_code,possible_lengths) values
${tuples};
create function private.valid_whatsapp(p_phone text) returns boolean
language plpgsql stable set search_path='' as $$
declare digits text;
begin
  if p_phone is null then return false; end if;
  if p_phone !~ '^\\+[1-9][0-9]{1,14}$' then
    return p_phone ~ '^(${ddds})([2-9][0-9]{7}|9[0-9]{8})$';
  end if;
  digits:=substring(p_phone from 2);
  if digits like '55%' then return substring(digits from 3) ~ '^(${ddds})([2-9][0-9]{7}|9[0-9]{8})$'; end if;
  return exists(select 1 from private.phone_lengths where left(digits,length(country_code))=country_code
    and length(digits)-length(country_code)=any(possible_lengths));
end; $$;
revoke all on function private.valid_whatsapp(text) from public,anon,authenticated;
${validator}
commit;
`;
const target='supabase/migrations/009_whatsapp_validation.sql';
if(fs.existsSync(target))throw new Error('Do not overwrite an existing migration.');
fs.writeFileSync(target,sql,'utf8');
fs.writeFileSync('src/lib/phone-limits.json',JSON.stringify(clientLimits,null,2)+'\n','utf8');
console.log('Generated '+target+'; country calling codes: '+plans.size);
