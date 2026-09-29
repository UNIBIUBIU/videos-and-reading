import {lessons,groups} from './lessons.js';
import {chapters} from './chapters.js';
import {attachments} from './attachments.js';
import {unlock,assetURL,filename,clearAccess} from './vault.js';
const $=id=>document.getElementById(id);
const player=$('player');
let selected=null,pendingSeek=null,chapterButtons=[],selectionRevision=0;
function el(tag,text,className){const node=document.createElement(tag);if(text!==null&&text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function status(message,error=false){$('access-status').textContent=message;$('access-status').classList.toggle('error',error);}
function seconds(lesson){return lesson.duration.split(':').reduce((n,x)=>n*60+Number(x),0);}
function time(value){const s=Math.max(0,Math.floor(value||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function duration(){return Number.isFinite(player.duration)?player.duration:selected?seconds(selected):0;}
function renderIndex(){
 groups.forEach((group,i)=>{
  $('index-list').append(el('h3',group,'unit-label'));
  $('playlist').append(el('h3',group,'playlist-group'));
  lessons.filter(lesson=>lesson.group===i).forEach(lesson=>{
   const row=el('article',null,'index-row');
   row.append(el('span',lesson.id,'number'),el('h3',lesson.title),el('time',lesson.duration));$('index-list').append(row);
   const button=el('button',null,'lesson-button');button.type='button';button.dataset.lesson=lesson.id;button.setAttribute('aria-label','Play '+lesson.title+', '+lesson.duration);
   button.append(el('span',lesson.id,'number'),el('span',lesson.title),el('time',lesson.duration));
   button.addEventListener('click',()=>select(lesson,true));$('playlist').append(button);
  });
 });
}
function renderChapters(){
 const list=chapters[selected.id]||[];
 $('chapters-section').hidden=!list.length;$('chapter-list').replaceChildren();$('seek-marks').replaceChildren();
 chapterButtons=list.map(([start,title],i)=>{
  const button=el('button',null,'chapter-button');button.type='button';button.dataset.chapter=String(i);
  button.setAttribute('aria-label','Jump to '+time(start)+': '+title);button.append(el('time',time(start)),el('span',title));
  button.addEventListener('click',()=>{seekTo(start,true);history.replaceState(null,'','#film-'+selected.id+'&t='+start);});
  $('chapter-list').append(button);
  if(start>0){const mark=el('span');mark.style.left=(start/seconds(selected)*100)+'%';$('seek-marks').append(mark);}
  return button;
 });
 updateProgress();
}
function seekTo(target,play=false){
 const start=Math.min(Math.max(0,target),Math.max(0,duration()-.05));
 if(player.readyState>=1){player.currentTime=start;pendingSeek=null;updateProgress();}
 else pendingSeek=start;
 if(play)player.play().catch(()=>{});
}
async function select(lesson,play=false,start=0){
 const revision=++selectionRevision;
 player.pause();player.removeAttribute('src');player.load();selected=lesson;pendingSeek=start>0?start:null;
 $('player-error').hidden=true;$('player-status').textContent='Loading tutorial…';
 $('playing-number').textContent=lesson.id;$('playing-title').textContent=lesson.title;
 $('reading-link').href='reading.html#'+lesson.reading;$('next-button').hidden=lesson.id===lessons.at(-1).id;
 renderAttachments(lesson);
 document.querySelectorAll('[data-lesson]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.lesson===lesson.id)));
 const title=document.querySelector('.playing-title');title.classList.remove('is-changing');void title.offsetWidth;title.classList.add('is-changing');
 history.replaceState(null,'','#film-'+lesson.id+(start?'&t='+start:''));renderChapters();updatePlayback();
 try{
  const url=await assetURL('video-'+lesson.id);if(revision!==selectionRevision)return;
  player.src=url;player.load();$('player-status').textContent='';
  if(play)player.play().catch(()=>{});
 }catch(error){if(revision===selectionRevision){$('player-status').textContent='';$('player-error').textContent=error.message;$('player-error').hidden=false;}}
}
function updateProgress(){
 const total=duration(),current=player.currentTime||0;
 $('seek').max=String(total||100);$('seek').value=String(current);$('seek').style.setProperty('--progress',(total?current/total*100:0)+'%');
 $('seek').setAttribute('aria-valuetext',time(current)+' of '+time(Math.round(total)));$('play-time').textContent=time(current)+' / '+time(Math.round(total));
 const list=selected?chapters[selected.id]||[]:[];
 let active=-1;for(let i=0;i<list.length;i++)if(current+.05>=list[i][0])active=i;
 chapterButtons.forEach((button,i)=>{
  button.setAttribute('aria-current',String(i===active));
  const end=list[i+1]?.[0]||total;
  button.style.setProperty('--chapter-progress',Math.max(0,Math.min(100,(current-list[i][0])/(end-list[i][0])*100))+'%');
 });
}
function updatePlayback(){
 const playing=!player.paused&&!player.ended;
 $('player-wrap').classList.toggle('is-playing',playing);$('play-toggle').setAttribute('aria-label',playing?'Pause':'Play');$('play-overlay').hidden=playing||!selected;
}
function togglePlayback(){if(!selected)return;if(player.paused||player.ended)player.play().catch(()=>{});else player.pause();}
function lock(message=''){
 ++selectionRevision;clearAccess();selected=null;pendingSeek=null;player.pause();player.removeAttribute('src');player.load();
 $('attachments').replaceChildren();$('player-status').textContent='';$('player-section').hidden=true;$('access-panel').hidden=false;$('film-index').hidden=false;status(message);
}
async function loadLibrary(){
 $('access-panel').hidden=true;$('film-index').hidden=true;$('player-section').hidden=false;
 const hash=/^#film-(\d{2})(?:&t=(\d+(?:\.\d+)?))?$/.exec(location.hash);
 const requested=lessons.find(lesson=>lesson.id===hash?.[1]);
 await select(requested||lessons[0],false,requested?Math.min(Number(hash?.[2]||0),seconds(requested)-1):0);
}
renderIndex();player.controls=false;$('player-controls').hidden=false;
$('access-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;status('Opening tutorials…');
 try{await unlock($('password').value);$('password').value='';await loadLibrary();status('');}
 catch(error){status(error.message,true);}finally{button.disabled=false;}
});
$('lock-button').addEventListener('click',()=>{lock();$('password').focus();});
$('next-button').addEventListener('click',()=>{const next=lessons[lessons.indexOf(selected)+1];if(next)select(next,true);});
$('play-toggle').addEventListener('click',togglePlayback);$('play-overlay').addEventListener('click',togglePlayback);player.addEventListener('click',togglePlayback);
player.addEventListener('keydown',event=>{if([' ','k'].includes(event.key)){event.preventDefault();togglePlayback();}else if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();seekTo(player.currentTime+(event.key==='ArrowLeft'?-5:5));}});
player.addEventListener('contextmenu',event=>event.preventDefault());
player.addEventListener('timeupdate',updateProgress);player.addEventListener('seeked',updateProgress);
player.addEventListener('loadedmetadata',()=>{player.playbackRate=Number($('playback-speed').value);if(pendingSeek!==null){player.currentTime=Math.min(pendingSeek,player.duration-.05);pendingSeek=null;}updateProgress();});
for(const event of ['play','pause','ended'])player.addEventListener(event,updatePlayback);
player.addEventListener('error',()=>{if(selected)$('player-error').hidden=false;});
$('seek').addEventListener('input',event=>seekTo(Number(event.target.value)));
$('playback-speed').addEventListener('change',event=>player.playbackRate=Number(event.target.value));
$('mute-toggle').addEventListener('click',()=>{player.muted=!player.muted;});
player.addEventListener('volumechange',()=>{$('mute-toggle').setAttribute('aria-pressed',String(player.muted));$('mute-toggle').setAttribute('aria-label',player.muted?'Unmute':'Mute');});
$('fullscreen-toggle').hidden=!document.fullscreenEnabled;
$('fullscreen-toggle').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('player-wrap').requestFullscreen();}catch{}});
document.addEventListener('fullscreenchange',()=>$('fullscreen-toggle').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));


function renderAttachments(lesson){
 const host=$('attachments');host.replaceChildren();
 for(const [index,item] of (attachments[lesson.id]||[]).entries()){
  const id=(index===0?'guide-':'materials-')+lesson.id;
  const a=el('a',null,'skill-guide');a.href='#';
  const copy=el('div');copy.append(el('h3',item.title),el('p',item.detail));
  const action=el('span','Download ↓','skill-guide-action');a.append(copy,action);host.append(a);
  a.addEventListener('click',async event=>{
   event.preventDefault();if(a.getAttribute('aria-busy')==='true')return;
   a.setAttribute('aria-busy','true');action.textContent='Loading…';
   try{const url=await assetURL(id);const download=document.createElement('a');download.href=url;download.download=filename(id);document.body.append(download);download.click();download.remove();action.textContent='Download again ↓';}
   catch(error){action.textContent='Retry ↓';$('player-status').textContent=error.message;}
   finally{a.removeAttribute('aria-busy');}
  });
 }
}
window.addEventListener('pagehide',()=>{clearAccess();});
window.addEventListener('pageshow',event=>{if(event.persisted)lock();});
