import {lessons,groups} from './lessons.js';
const api='https://prompting-five-minutes-weidi.zhangweidilydia.chatgpt.site';
const key='video-reading-session';
const $=id=>document.getElementById(id);
let token='',files=[],selected=null;
try{token=sessionStorage.getItem(key)||'';}catch{}
function saveToken(value){token=value;try{value?sessionStorage.setItem(key,value):sessionStorage.removeItem(key);}catch{}}
function el(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
function status(message,error=false){$('access-status').textContent=message;$('access-status').classList.toggle('error',error);}
function fileFor(lesson){return files.find(file=>file.slot===`week04-${lesson.id}`&&file.kind==='video');}
function renderIndex(){
  groups.forEach((group,i)=>{
    $('index-list').append(el('h3',group,'unit-label'));
    $('playlist').append(el('h3',group,'playlist-group'));
    lessons.filter(lesson=>lesson.group===i).forEach(lesson=>{
      const row=el('article',null,'index-row');row.append(el('span',lesson.id,'number'),el('h3',lesson.title),el('p',lesson.description),el('time',lesson.duration));$('index-list').append(row);
      const button=el('button',null,'lesson-button');button.type='button';button.dataset.lesson=lesson.id;button.setAttribute('aria-label',`Play ${lesson.title}, ${lesson.duration}`);button.append(el('span',lesson.id,'number'),el('span',lesson.title),el('time',lesson.duration));button.addEventListener('click',()=>select(lesson,true));$('playlist').append(button);
    });
  });
}
function select(lesson,play=false){
  const file=fileFor(lesson);if(!file)return;
  selected=lesson;$('player').pause();$('player-error').hidden=true;$('player').src=file.url;
  $('playing-number').textContent=`FILM ${lesson.id} / ${lesson.duration}`;$('playing-title').textContent=lesson.title;$('playing-description').textContent=lesson.description;
  $('reading-link').href=`reading.html#${lesson.reading}`;$('download-link').href=`${file.url}&download=1`;
  $('next-button').hidden=lesson.id==='10';
  document.querySelectorAll('[data-lesson]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.lesson===lesson.id)));
  history.replaceState(null,'',`#film-${lesson.id}`);
  if(play)$('player').play().catch(()=>{});
}
function lock(message=''){
  saveToken('');files=[];selected=null;$('player').pause();$('player').removeAttribute('src');$('player').load();$('player-section').hidden=true;$('access-panel').hidden=false;$('film-index').hidden=false;status(message);
}
async function loadLibrary(){
  const response=await fetch(`${api}/api/pages-files`,{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
  if(response.status===401){lock('Enter your password to continue.');return false;}
  if(!response.ok)throw new Error('The video library could not load. Please try again.');
  const data=await response.json();files=data.files.filter(file=>/^week04-(0[1-9]|10)$/.test(file.slot));
  if(!lessons.some(lesson=>fileFor(lesson)))throw new Error('The videos are being prepared. Please try again shortly.');
  $('access-panel').hidden=true;$('film-index').hidden=true;$('player-section').hidden=false;
  document.querySelectorAll('[data-lesson]').forEach(button=>button.disabled=!fileFor(lessons.find(lesson=>lesson.id===button.dataset.lesson)));
  const requested=lessons.find(lesson=>location.hash===`#film-${lesson.id}`&&fileFor(lesson));select(requested||lessons.find(lesson=>fileFor(lesson)));return true;
}
renderIndex();
$('access-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;status('Opening the video library…');
  try{
    const response=await fetch(`${api}/api/pages-session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value}),credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(response.status===401?'Please check the password and try again.':'Could not open the library. Please try again.');
    const data=await response.json();saveToken(data.token);$('password').value='';await loadLibrary();
  }catch(error){status(error instanceof TypeError?'Could not connect. Please check your connection and try again.':error.message,true);}finally{button.disabled=false;}
});
$('lock-button').addEventListener('click',()=>{lock();$('password').focus();});
$('next-button').addEventListener('click',()=>{const next=lessons[lessons.indexOf(selected)+1];if(next)select(next,true);});
$('player').addEventListener('error',()=>{$('player-error').hidden=false;});
if(token){status('Checking access…');loadLibrary().catch(error=>status(error.message,true));}
