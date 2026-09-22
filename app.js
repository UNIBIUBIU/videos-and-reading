import {lessons,groups} from './lessons.js';
import {chapters} from './chapters.js';
const api='https://prompting-five-minutes-weidi.zhangweidilydia.chatgpt.site';
const key='video-reading-session';
const $=id=>document.getElementById(id);
const player=$('player');
let token='',files=[],selected=null,pendingSeek=null,chapterButtons=[];
try{token=sessionStorage.getItem(key)||'';}catch{}
function saveToken(value){token=value;try{value?sessionStorage.setItem(key,value):sessionStorage.removeItem(key);}catch{}}
function el(tag,text,className){const node=document.createElement(tag);if(text!==null&&text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function status(message,error=false){$('access-status').textContent=message;$('access-status').classList.toggle('error',error);}
function fileFor(lesson){return files.find(file=>file.slot==='week04-'+lesson.id&&file.kind==='video');}
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
function select(lesson,play=false,start=0){
 const file=fileFor(lesson);if(!file)return;
 player.pause();selected=lesson;pendingSeek=start>0?start:null;$('player-error').hidden=true;player.src=file.url;player.load();
 $('playing-number').textContent=lesson.id;$('playing-title').textContent=lesson.title;
 $('reading-link').href='reading.html#'+lesson.reading;$('next-button').hidden=lesson.id==='10';
 $('skill-guide').hidden=lesson.id!=='10';
 document.querySelectorAll('[data-lesson]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.lesson===lesson.id)));
 const title=document.querySelector('.playing-title');title.classList.remove('is-changing');void title.offsetWidth;title.classList.add('is-changing');
 history.replaceState(null,'','#film-'+lesson.id+(start?'&t='+start:''));
 renderChapters();updatePlayback();
 if(play)player.play().catch(()=>{});
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
 saveToken('');files=[];selected=null;pendingSeek=null;player.pause();player.removeAttribute('src');player.load();
 $('player-section').hidden=true;$('access-panel').hidden=false;$('film-index').hidden=false;status(message);
}
async function loadLibrary(){
 const response=await fetch(api+'/api/pages-files',{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
 if(response.status===401){lock('Enter your password to continue.');return false;}
 if(!response.ok)throw new Error('The tutorials could not load. Please try again.');
 const data=await response.json();files=data.files.filter(file=>/^week04-(0[1-9]|10)$/.test(file.slot));
 if(!lessons.some(lesson=>fileFor(lesson)))throw new Error('The tutorials are being prepared. Please try again shortly.');
 $('access-panel').hidden=true;$('film-index').hidden=true;$('player-section').hidden=false;
 document.querySelectorAll('[data-lesson]').forEach(button=>button.disabled=!fileFor(lessons.find(lesson=>lesson.id===button.dataset.lesson)));
 const hash=/^#film-(\d{2})(?:&t=(\d+(?:\.\d+)?))?$/.exec(location.hash);
 const requested=lessons.find(lesson=>lesson.id===hash?.[1]&&fileFor(lesson));
 const lesson=requested||lessons.find(lesson=>fileFor(lesson));select(lesson,false,requested?Math.min(Number(hash?.[2]||0),seconds(lesson)-1):0);return true;
}
renderIndex();player.controls=false;$('player-controls').hidden=false;
$('access-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;status('Opening tutorials…');
 try{
  const response=await fetch(api+'/api/pages-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value}),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error(response.status===401?'Please check the password and try again.':'Could not open the tutorials. Please try again.');
  const data=await response.json();saveToken(data.token);$('password').value='';await loadLibrary();
 }catch(error){status(error instanceof TypeError?'Could not connect. Please check your connection and try again.':error.message,true);}finally{button.disabled=false;}
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
if(token){status('Checking access…');loadLibrary().catch(error=>status(error.message,true));}
