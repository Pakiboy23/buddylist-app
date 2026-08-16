-- Content moderation: server-side profanity filter.
-- Phase 3 of App Store submission prep (Apple Guideline 1.2 - filter
-- objectionable material). Wordlist sourced from the `bad-words` npm
-- package; regenerate via scripts/generate-profanity-terms.mjs.

begin;

alter table public.messages
  add column if not exists flagged_at timestamptz null;

alter table public.room_messages
  add column if not exists flagged_at timestamptz null;

create index if not exists messages_flagged_idx
  on public.messages (flagged_at desc)
  where flagged_at is not null;

create index if not exists room_messages_flagged_idx
  on public.room_messages (flagged_at desc)
  where flagged_at is not null;

create or replace function public.message_content_appears_objectionable(input text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(input), '') ~* '\m(4r5e|5h1t|5hit|a55|ahole|amcik|anal|andskota|anus|ar5e|arrse|arschloch|arse|ash0le|ash0les|asholes|ass|ass monkey|asses|assface|assfucker|assfukka|assh0le|assh0lez|asshole|assholes|assholz|assrammer|asswhole|asswipe|ayir|azzhole|b00b|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bassterds|bastard|bastards|bastardz|basterds|basterdz|bch|beastial|beastiality|bellend|bestial|bestiality|bi7ch|biatch|bich|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boffing|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|btch|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttpirate|buttplug|buttwipe|c0ck|c0cks|c0cksucker|c0k|cabron|carpet muncher|cawk|cawks|cazzo|chink|chraa|chuj|cipa|cl1t|clit|clitoris|clits|cnts|cntz|cnut|cock|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cuntz|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|d4mn|damn|daygo|dego|dick|dickhead|dike|dild0|dild0s|dildo|dildos|dilld0|dilld0s|dink|dinks|dirsa|dlck|dogfucker|doggin|dogging|dominatricks|dominatrics|dominatrix|donkeyribber|doosh|duche|dupa|dyke|dziwka|ejackulate|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|ekrem|ekto|enculer|enema|f u c k|f u c k e r|f4nny|faen|fag|fag1t|faget|fagg0t|fagg1t|fagging|faggit|faggitt|faggot|faggs|fagit|fagot|fagots|fags|fagz|faig|faigs|fanculo|fanny|fannyflaps|fannyfucker|fanyy|fart|fatass|fcuk|fcuker|fcuking|feces|feck|fecker|feg|felcher|felching|fellate|fellatio|ficken|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|fitt|flange|flikker|flipping the bird|fook|fooker|foreskin|fotze|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fukah|fuken|fuker|fukin|fukk|fukkah|fukken|fukker|fukkin|fuks|fukwhit|fukwit|futkretzn|fux|fux0r|g00k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|god|goddam|goddamn|goddamned|gook|guiena|h00r|h0ar|h0r|h0re|h4x0r|hardcoresex|hell|hells|helvete|heshe|hoar|hoare|hoer|homo|honkey|hoor|hoore|hore|horniest|horny|hotsex|huevon|hui|injun|jackoff|jap|japs|jerkoff|jisim|jism|jiss|jiz|jizm|jizz|kanker|kawk|kike|klootzak|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|knobs|knobz|knulle|kock|kondum|kondums|kraut|kuk|kuksuger|kum|kummer|kumming|kums|kunilingus|kunt|kunts|kuntz|kurac|kurwa|kusi|kyrpa|l3ich|l3itch|labia|lesbo|lezzian|lipshits|lipshitz|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|mamhoon|masochist|masokist|massterbait|masstrbait|masstrbate|masterb8|masterbaiter|masterbat|masterbat3|masterbate|masterbates|masterbation|masterbations|masturbat|masturbate|merd|mibun|mof0|mofo|monkleigh|motha fucker|motha fuker|motha fukkah|motha fukker|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|mother fukah|mother fuker|mother fukkah|mother fukker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|mouliewop|muff|muie|mulkku|muschi|mutha|mutha fucker|mutha fukah|mutha fuker|mutha fukkah|mutha fukker|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|n1gr|nastt|nazi|nazis|nepesaurio|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nigur|niiger|niigr|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orafis|orgasim|orgasims|orgasm|orgasms|orgasum|oriface|orifice|orifiss|orospu|p0rn|packi|packie|packy|paki|pakie|paky|paska|pawn|pecker|peeenus|peeenusss|peenus|peinus|pen1s|penas|penis|penisbreath|penisfucker|penus|penuus|perse|phonesex|phuc|phuck|phuk|phuked|phuker|phuking|phukked|phukker|phukking|phuks|phuq|picka|pierdol|pigfucker|pillu|pimmel|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|pizda|polac|polack|polak|poonani|poontsee|poop|porn|porno|pornography|pornos|pr0n|pr1c|pr1ck|pr1k|preteen|prick|pricks|pron|pube|pula|pule|pusse|pussee|pussi|pussies|pussy|pussys|puta|puto|puuke|puuker|qahbeh|queef|rautenberg|recktum|rectum|retard|rimjaw|rimming|s hit|sadist|scank|schaffer|scheiss|schlampe|schlong|schmuck|screw|screwing|scroat|scrote|scrotum|semen|sex|sexy|sh1t|sh1ter|sh1ts|sh1tter|sh1tz|shag|shagger|shaggin|shagging|sharmuta|sharmute|shemale|shi|shipal|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|shity|shitz|shiz|sht|shyt|shyte|shytty|shyty|skanck|skank|skankee|skankey|skanks|skanky|skribz|skurwysyn|slag|slut|sluts|slutty|slutz|smegma|smut|snatch|sob|sonofabitch|spac|sphencter|spic|spierdalaj|splooge|spunk|suka|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|va1jina|vag1na|vagiina|vagina|vaj1na|vajina|viagra|vittu|vullva|vulva|w00se|w0p|wang|wank|wanker|wanky|wetback|wh00r|wh0re|whoar|whore|wichser|willies|willy|wop|xrated|xxx|yed|zabourah)\M';
$$;

create or replace function public.flag_objectionable_message()
returns trigger
language plpgsql
as $$
begin
  if public.message_content_appears_objectionable(new.content) then
    new.flagged_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

create or replace function public.flag_objectionable_room_message()
returns trigger
language plpgsql
as $$
begin
  -- room_messages stores text in `body` (not `content` like the DM messages table).
  if public.message_content_appears_objectionable(new.body) then
    new.flagged_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

drop trigger if exists messages_flag_objectionable on public.messages;
create trigger messages_flag_objectionable
before insert on public.messages
for each row
execute function public.flag_objectionable_message();

drop trigger if exists room_messages_flag_objectionable on public.room_messages;
create trigger room_messages_flag_objectionable
before insert on public.room_messages
for each row
execute function public.flag_objectionable_room_message();

commit;
