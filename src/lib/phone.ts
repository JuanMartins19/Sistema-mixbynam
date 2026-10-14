import {AsYouType,parsePhoneNumberFromString} from 'libphonenumber-js/min';
import phoneLimits from './phone-limits.json';

export const brazilDdds=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
function brazilValid(digits:string){return brazilDdds.has(digits.slice(0,2))&&/^(?:[2-9]\d{7}|9\d{8})$/.test(digits.slice(2));}
export function normalizeWhatsapp(value:string):string{
  if(!/^\+?[\d ()-]+$/.test(value.trim()))throw new Error('Use somente números no WhatsApp.');
  const digits=value.replace(/\D/g,'');
  if(!value.trim().startsWith('+')){
    if(!brazilValid(digits))throw new Error('Informe um DDD válido e um número de 8 dígitos, ou 9 dígitos começando com 9.');
    return '+55'+digits;
  }
  if(digits.startsWith('55')){
    if(!brazilValid(digits.slice(2)))throw new Error('Após +55, informe DDD e número brasileiro de 8 ou 9 dígitos.');
    return '+'+digits;
  }
  const phone=parsePhoneNumberFromString('+'+digits);
  if(digits.length>15||!phone?.isPossible()||(phone.countryCallingCode==='1'&&phone.nationalNumber.length!==10))throw new Error('Confira o código do país e a quantidade de dígitos do telefone internacional.');
  return phone.number;
}
export function formatWhatsappInput(value:string,international=false){
  let digits=value.replace(/\D/g,'').slice(0,international?15:11);
  if(international){
    const code=Object.keys(phoneLimits).find(code=>digits.startsWith(code));
    if(code)digits=digits.slice(0,(phoneLimits as Record<string,number>)[code]);
    return digits?new AsYouType().input('+'+digits):'';
  }
  if(digits.length<=2)return digits;
  const subscriber=digits.slice(2),split=subscriber.length>8?5:4;
  return `(${digits.slice(0,2)}) ${subscriber.slice(0,split)}${subscriber.length>split?'-'+subscriber.slice(split):''}`;
}
