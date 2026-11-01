"use strict";
const $=id=>document.getElementById(id);
const languages=[["Italiano","🇮🇹","it","it-IT","ita"],["English","🇬🇧","en","en-US","eng"],["Français","🇫🇷","fr","fr-FR","fra"],["Español","🇪🇸","es","es-ES","spa"],["Deutsch","🇩🇪","de","de-DE","deu"],["Português","🇵🇹","pt","pt-PT","por"],["العربية","🇸🇦","ar","ar-SA","ara"],["বাংলা (Bangladesh)","🇧🇩","bn","bn-BD","ben"],["हिन्दी","🇮🇳","hi","hi-IN","hin"],["اردو","🇵🇰","ur","ur-PK","urd"],["中文","🇨🇳","zh-CN","zh-CN","chi_sim"],["日本語","🇯🇵","ja","ja-JP","jpn"],["한국어","🇰🇷","ko","ko-KR","kor"],["Русский","🇷🇺","ru","ru-RU","rus"],["Türkçe","🇹🇷","tr","tr-TR","tur"],["Polski","🇵🇱","pl","pl-PL","pol"],["Nederlands","🇳🇱","nl","nl-NL","nld"],["Ελληνικά","🇬🇷","el","el-GR","ell"],["Română","🇷🇴","ro","ro-RO","ron"],["Українська","🇺🇦","uk","uk-UA","ukr"]];
const src=$("source-lang"),dst=$("target-lang"),input=$("input-text"),output=$("output-text"),status=$("status-text"),dot=$("status-dot"),bar=$("progress-bar"),progressLabel=$("progress-label"),splashDetail=$("splash-detail");
languages.forEach(l=>{src.add(new Option(l[1]+" "+l[0],l[2]));dst.add(new Option(l[1]+" "+l[0],l[2]))});
src.value="it";dst.value="en";
const lang=code=>languages.find(l=>l[2]===code)||languages[0],ocrLang=code=>lang(code)[4],voiceLang=code=>lang(code)[3];
function setStatus(m,t=""){status.textContent=m;dot.className="dot"+(t?" "+t:"")}
function progress(p,m){if(Number.isFinite(p))bar.style.width=Math.round(Math.max(0,Math.min(1,p))*100)+"%";if(m)progressLabel.textContent=m}
function finishSplash(m){bar.style.width="100%";progressLabel.textContent=m;$("app").style.display="block";setTimeout(()=>{$("splash").style.display="none"},250)}
let worker=null,workerLang="",ocrBusy=!1,translating=!1,recognition=null,manualRecognition=!1,conversationActive=!1,conversationBusy=!1,conversationTimer=null,history=[];
try{history=JSON.parse(localStorage.getItem("translator-history")||"[]");if(!Array.isArray(history))history=[]}catch(e){history=[]}
function updateCounter(){$("char-count").textContent=input.value.length+" caratteri"}
input.addEventListener("input",updateCounter);
async function ensureOCR(code){
  const wanted=ocrLang(code);
  if(worker&&workerLang===wanted)return worker;
  if(ocrBusy)throw new Error("Il riconoscimento testo è già in preparazione.");
  ocrBusy=!0;
  try{
    if(worker){await worker.terminate();worker=null;workerLang=""}
    if(!window.Tesseract)throw new Error("Motore OCR non disponibile. Controlla la connessione.");
    worker=await Tesseract.createWorker(wanted,1,{logger:m=>{
      if(m.status){splashDetail.textContent=m.status;progress(m.progress,m.status)}
      if(m.status==="recognizing text"&&m.progress)setStatus("Riconoscimento testo "+Math.round(m.progress*100)+"%","busy")
    }});
    workerLang=wanted;
    return worker
  }finally{ocrBusy=!1}
}
async function startApp(){
  try{
    progress(.05,"Avvio del motore OCR");
    splashDetail.textContent="Preparazione del riconoscimento italiano";
    await ensureOCR("it");
    progress(1,"OCR pronto");
    finishSplash("Tutto pronto")
  }catch(e){
    console.warn(e);
    finishSplash("Traduttore pronto · OCR disponibile al primo utilizzo");
    setStatus("OCR verrà preparato quando servirà","")
  }
}
startApp();
function splitText(t,max=450){
  const words=t.split(/\s+/),chunks=[];
  let cur="";
  for(const w of words){
    if(!w)continue;
    if(w.length>max){
      if(cur)chunks.push(cur);
      cur="";
      for(let i=0;i<w.length;i+=max)chunks.push(w.slice(i,i+max));
      continue
    }
    const c=cur?cur+" "+w:w;
    if(c.length>max){chunks.push(cur);cur=w}else cur=c
  }
  if(cur)chunks.push(cur);
  return chunks
}
async function translateText(t,from,to){
  if(from===to)return t;
  const chunks=splitText(t),res=[];
  for(const ch of chunks){
    const p=new URLSearchParams({q:ch,langpair:from+"|"+to});
    const r=await fetch("https://api.mymemory.translated.net/get?"+p);
    if(!r.ok)throw new Error("Errore di connessione al servizio di traduzione");
    const d=await r.json();
    if(Number(d.responseStatus)!==200)throw new Error(d.responseDetails||"Traduzione non disponibile");
    res.push(d.responseData.translatedText)
  }
  return res.join(" ")
}
async function doTranslation(o={}){
  const t=o.text??input.value.trim(),from=o.from??src.value,to=o.to??dst.value;
  if(!t){if(!o.silent)setStatus("Inserisci prima un testo da tradurre","error");return null}
  if(translating)return null;
  translating=!0;
  $("translate-btn").disabled=!0;
  $("translate-btn").textContent="⏳ Traduzione...";
  setStatus("Sto traducendo...","busy");
  try{
    const r=await translateText(t,from,to);
    if(!o.silent)output.value=r;
    addHistory(t,r,from,to);
    setStatus("Traduzione completata","ok");
    return r
  }catch(e){
    console.error(e);
    setStatus(e.message||"Errore di traduzione","error");
    return null
  }finally{
    translating=!1;
    $("translate-btn").disabled=!1;
    $("translate-btn").textContent="🌍 Traduci"
  }
}
$("translate-btn").addEventListener("click",()=>doTranslation());
$("swap-btn").addEventListener("click",()=>{
  const a=src.value;src.value=dst.value;dst.value=a;
  const t=input.value;input.value=output.value;output.value=t;
  updateCounter();stopSpeech();updateOnlineLabels();
  setStatus("Lingue invertite","ok")
});
$("clear-btn").addEventListener("click",()=>{
  input.value="";output.value="";
  updateCounter();stopSpeech();
  setStatus("Testo cancellato","ok")
});
$("copy-btn").addEventListener("click",async()=>{
  if(!output.value.trim()){setStatus("Non c'è nulla da copiare","error");return}
  try{await navigator.clipboard.writeText(output.value);setStatus("Traduzione copiata","ok")}
  catch(e){output.select();setStatus(document.execCommand("copy")?"Traduzione copiata":"Impossibile copiare","ok")}
});
function stopSpeech(){if("speechSynthesis"in window)speechSynthesis.cancel()}
function speak(t,code){
  return new Promise(res=>{
    if(!("speechSynthesis"in window)||!t){res();return}
    stopSpeech();
    const u=new SpeechSynthesisUtterance(t);
    u.lang=voiceLang(code);u.rate=.92;u.onend=res;u.onerror=res;
    speechSynthesis.speak(u)
  })
}
$("tts-btn").addEventListener("click",()=>{
  if(!output.value.trim()){setStatus("Nessuna traduzione da ascoltare","error");return}
  speak(output.value,dst.value)
});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function makeRecognition(code){
  if(!SR){setStatus("Riconoscimento vocale non supportato: prova Chrome","error");return null}
  const r=new SR();r.lang=voiceLang(code);r.continuous=!1;r.interimResults=!0;r.maxAlternatives=1;return r
}
function stopRecognition(){
  if(recognition){
    const r=recognition;recognition=null;
    r.onresult=r.onend=r.onerror=null;
    try{r.abort()}catch(e){}
  }
}
function startManual(){
  if(!SR){setStatus("Microfono non supportato","error");return}
  if(conversationActive)stopConversation();
  stopRecognition();stopSpeech();
  let finalText="";
  manualRecognition=!0;
  const r=makeRecognition(src.value);
  if(!r)return;
  recognition=r;
  $("stt-btn").textContent="⏹️ Ferma ascolto";
  setStatus("Parla adesso...","busy");
  r.onresult=e=>{
    let interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const p=e.results[i][0].transcript;
      if(e.results[i].isFinal)finalText+=(finalText?" ":"")+p;
      else interim+=p
    }
    input.value=(finalText+(interim?" "+interim:"")).trim();
    updateCounter()
  };
  r.onerror=e=>setStatus("Errore microfono: "+e.error,"error");
  r.onend=()=>{
    if(recognition===r)recognition=null;
    manualRecognition=!1;
    $("stt-btn").textContent="🎙️ Microfono";
    if(finalText.trim()){input.value=finalText.trim();updateCounter();setStatus("Voce acquisita","ok")}
    else setStatus("Nessuna voce rilevata")
  };
  try{r.start()}
  catch(e){manualRecognition=!1;$("stt-btn").textContent="🎙️ Microfono";setStatus("Impossibile avviare il microfono","error")}
}
$("stt-btn").addEventListener("click",()=>{
  if(manualRecognition){
    stopRecognition();manualRecognition=!1;
    $("stt-btn").textContent="🎙️ Microfono";
    setStatus("Ascolto interrotto")
  }else startManual()
});
function saveHistory(){try{localStorage.setItem("translator-history",JSON.stringify(history))}catch(e){}}
function addHistory(original,translated,from,to){
  history.unshift({original,translated,from,to,date:new Date().toLocaleString()});
  history=history.slice(0,15);
  saveHistory();renderHistory()
}
function renderHistory(){
  const list=$("history-list");list.replaceChildren();
  if(!history.length){
    const d=document.createElement("div");
    d.className="empty";d.textContent="Nessuna traduzione salvata";
    list.append(d);return
  }
  history.forEach(item=>{
    const b=document.createElement("button");b.className="history-item";
    const s=document.createElement("small");
    s.textContent=lang(item.from)[0]+" → "+lang(item.to)[0]+" · "+item.date;
    const t=document.createElement("span");
    t.textContent=item.original+" → "+item.translated;
    b.append(s,t);
    b.addEventListener("click",()=>{
      src.value=item.from;dst.value=item.to;
      input.value=item.original;output.value=item.translated;
      updateCounter();updateOnlineLabels();
      setStatus("Traduzione recuperata","ok");
      window.scrollTo({top:0,behavior:"smooth"})
    });
    list.append(b)
  })
}
$("history-clear").addEventListener("click",()=>{
  history=[];saveHistory();renderHistory();
  setStatus("Cronologia cancellata","ok")
});
renderHistory();
$("scan-btn").addEventListener("click",()=>{$("scan-input").click()});
$("scan-input").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){setStatus("Seleziona una fotografia","error");return}
  if(ocrBusy){setStatus("Attendi il caricamento OCR","busy");e.target.value="";return}
  const btn=$("scan-btn");
  btn.disabled=!0;btn.textContent="⏳ Riconoscimento...";
  try{
    setStatus("Preparazione OCR...","busy");
    const w=await ensureOCR(src.value);
    setStatus("Lettura del testo nella fotografia...","busy");
    const result=await w.recognize(file);
    const text=(result.data.text||"").trim();
    if(!text)throw new Error("Non è stato riconosciuto alcun testo. Prova una foto più nitida.");
    input.value=text;updateCounter();
    setStatus("Testo riconosciuto. Traduzione in corso...","busy");
    const translated=await doTranslation({text,from:src.value,to:dst.value});
    if(translated){output.value=translated;setStatus("Scansione e traduzione completate","ok")}
  }catch(err){
    console.error(err);
    setStatus(err.message||"Errore durante la scansione","error")
  }finally{
    btn.disabled=!1;btn.textContent="📷 Scansiona testo";e.target.value=""
  }
});
function updateConversationButton(){
  const b=$("conversation-btn");
  b.textContent=conversationActive?"⏹️ Ferma conversazione":"🗣️ Avvia modalità conversazione";
  b.classList.toggle("active",conversationActive)
}
function stopConversation(){
  conversationActive=!1;conversationBusy=!1;
  if(conversationTimer)clearTimeout(conversationTimer);
  conversationTimer=null;
  stopRecognition();stopSpeech();updateConversationButton();
  setStatus("Modalità conversazione terminata")
}
function listenConversation(){
  if(!conversationActive||conversationBusy)return;
  stopRecognition();
  const from=src.value,to=dst.value,r=makeRecognition(from);
  if(!r){stopConversation();return}
  recognition=r;
  let finalText="",handled=!1;
  setStatus("🎙️ Ascolto: "+lang(from)[0],"busy");
  r.onresult=e=>{
    for(let i=e.resultIndex;i<e.results.length;i++)
      if(e.results[i].isFinal)finalText+=(finalText?" ":"")+e.results[i][0].transcript
  };
  r.onerror=e=>{
    if(!conversationActive)return;
    if(e.error==="not-allowed"||e.error==="service-not-allowed"){
      setStatus("Permesso microfono negato","error");stopConversation()
    }
  };
  r.onend=async()=>{
    if(recognition===r)recognition=null;
    if(handled||!conversationActive)return;
    handled=!0;
    const spoken=finalText.trim();
    if(!spoken){conversationTimer=setTimeout(listenConversation,700);return}
    conversationBusy=!0;
    input.value=spoken;updateCounter();
    const translated=await doTranslation({text:spoken,from,to});
    if(!conversationActive){conversationBusy=!1;return}
    if(translated){
      output.value=translated;
      setStatus("🔊 Lettura della traduzione...","busy");
      await speak(translated,to);
      if(!conversationActive){conversationBusy=!1;return}
      src.value=to;dst.value=from;updateOnlineLabels();
      setStatus("Ora parla: "+lang(to)[0],"ok")
    }
    conversationBusy=!1;
    if(conversationActive)conversationTimer=setTimeout(listenConversation,800)
  };
  try{r.start()}
  catch(e){
    conversationBusy=!1;
    conversationTimer=setTimeout(()=>{if(conversationActive)listenConversation()},1200)
  }
}
$("conversation-btn").addEventListener("click",()=>{
  if(conversationActive){stopConversation();return}
  if(!SR){setStatus("Usa Chrome per la modalità conversazione","error");return}
  stopSpeech();stopRecognition();
  conversationActive=!0;conversationBusy=!1;
  updateConversationButton();
  setStatus("Modalità conversazione attiva","ok");
  listenConversation()
});
const ONLINE={code:null,room:null,sendUtterance:null,peers:new Set};
function onlineId(len=6){
  const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<len;i++)s+=a[Math.floor(Math.random()*a.length)];
  return s
}
function show(id,v){const el=$(id);if(el)el.style.display=v?"":"none"}
function setPeerStatus(m,t=""){
  const el=$("online-peer-status");
  if(!el)return;
  el.textContent=m;
  el.style.color=t==="ok"?"#3bd49a":t==="error"?"#ff647c":"#9eacc1"
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))
}
function addBubble(who,text,translated){
  const box=$("online-transcript"),d=document.createElement("div");
  d.className="bubble "+who;
  d.innerHTML=`<div class="who">${who==="me"?"Tu":"Peer"}</div><div class="orig">${escapeHtml(text)}</div>${translated?`<div class="trans">➜ ${escapeHtml(translated)}</div>`:""}`;
  box.append(d);
  box.scrollTop=box.scrollHeight
}
function updateOnlineLabels(){
  const s=lang(src.value),d=lang(dst.value);
  $("online-src-label").textContent=s[1]+" "+s[0];
  $("online-dst-label").textContent=d[1]+" "+d[0]
}
async function onlineLeave(){
  if(ONLINE.room){try{await ONLINE.room.leave()}catch(e){}}
  ONLINE.room=null;ONLINE.code=null;ONLINE.sendUtterance=null;
  ONLINE.peers.clear();
  show("online-room-info",!1);
  show("online-chat-actions",!1);
  $("online-transcript").replaceChildren();
  $("online-mic").textContent="🎙️ Parla e invia";
  setPeerStatus("In attesa dell'altro utente…")
}
async function onlineJoin(code){
  if(!window.__trystero){
    setStatus("Libreria P2P non ancora caricata, riprova tra un istante","error");
    return
  }
  await onlineLeave();
  ONLINE.code=code;
  $("online-room-code").textContent=code;
  show("online-room-info",!0);
  setPeerStatus("Connessione ai relay P2P…");
  const{joinRoom}=window.__trystero;
  const room=joinRoom({appId:"traduttore-p2p-v1"},{roomId:code});
  ONLINE.room=room;
  const[sendUtterance,onUtterance]=room.makeAction("utterance");
  ONLINE.sendUtterance=sendUtterance;
  room.onPeerJoin(id=>{
    ONLINE.peers.add(id);
    setPeerStatus("Peer connesso ✓","ok");
    show("online-chat-actions",!0)
  });
  room.onPeerLeave(id=>{
    ONLINE.peers.delete(id);
    if(ONLINE.peers.size===0){
      setPeerStatus("Peer disconnesso, in attesa…");
      show("online-chat-actions",!1)
    }
  });
  onUtterance(async(data,id)=>{
    try{
      const{text,from}=data,myLang=src.value;
      let translated=text;
      if(from&&from!==myLang)translated=await translateText(text,from,myLang)||text;
      addBubble("peer",text,translated);
      speak(translated,myLang)
    }catch(e){console.warn("peer msg",e)}
  });
  setTimeout(()=>{
    if(ONLINE.room&&ONLINE.peers.size===0)
      setPeerStatus("Nessun peer ancora. Condividi il codice.")
  },8000)
}
$("online-create").addEventListener("click",async()=>{
  const code=onlineId();
  $("online-code").value=code;
  await onlineJoin(code)
});
$("online-join").addEventListener("click",async()=>{
  const code=($("online-code").value||"").trim().toUpperCase();
  if(!code){setStatus("Inserisci un codice stanza","error");return}
  await onlineJoin(code)
});
$("online-copy").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(ONLINE.code);setStatus("Codice copiato","ok")}
  catch(e){setStatus("Impossibile copiare","error")}
});
$("online-leave").addEventListener("click",async()=>{
  await onlineLeave();
  setStatus("Uscito dalla stanza","ok")
});
$("online-mic").addEventListener("click",async()=>{
  if(!ONLINE.room||ONLINE.peers.size===0){setStatus("Peer non connesso","error");return}
  if(!SR){setStatus("Microfono non supportato","error");return}
  stopSpeech();stopRecognition();
  const r=makeRecognition(src.value);
  if(!r)return;
  recognition=r;
  let finalText="";
  setStatus("🎙️ Parla ora…","busy");
  $("online-mic").textContent="⏹️ Ferma";
  r.onresult=e=>{
    for(let i=e.resultIndex;i<e.results.length;i++)
      if(e.results[i].isFinal)finalText+=(finalText?" ":"")+e.results[i][0].transcript
  };
  r.onend=async()=>{
    recognition=null;
    $("online-mic").textContent="🎙️ Parla e invia";
    const text=finalText.trim();
    if(!text){setStatus("Nessuna voce rilevata");return}
    input.value=text;updateCounter();
    setStatus("Traduzione per il peer…","busy");
    const fromLang=src.value,toLang=dst.value;
    const translated=await translateText(text,fromLang,toLang);
    if(!translated){setStatus("Traduzione fallita","error");return}
    output.value=translated;
    addHistory(text,translated,fromLang,toLang);
    addBubble("me",text,translated);
    try{
      await ONLINE.sendUtterance({text,from:fromLang,to:toLang});
      setStatus("Inviato al peer ✓","ok")
    }catch(e){
      console.error(e);
      setStatus("Invio fallito","error")
    }
  };
  try{r.start()}
  catch(e){setStatus("Microfono non avviato","error")}
});
updateCounter();
updateOnlineLabels();
