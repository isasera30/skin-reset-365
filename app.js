const KEY='skinReset365_v1';
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
const diffDays=(a,b)=>Math.floor((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);
const avg=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const defaultState=()=>({startDate:today(),goalReason:'이 피부를 향해, 오늘도 한 걸음.',goalProgress:0,goalPhotos:[],actualPhotos:[],records:{},checks:{},futureLetter:'',xp:0,missions:{},missionHistory:[],customQuotes:[],favoriteQuotes:[],quoteHistory:{},reminder:{enabled:false,time:'21:30',weekend:true,skipDone:true,lastNotified:''},cycle:{startDate:'',endDate:'',cycleLength:28,periodLength:5},timeCapsules:{},lastBackupAt:'',flourFavorites:[],flourRecent:[],customFlourFoods:[],routineChecks:{}});
let state=load();
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');return {...defaultState(),...raw,reminder:{...defaultState().reminder,...(raw.reminder||{})},missions:{...(raw.missions||{})},missionHistory:[...(raw.missionHistory||[])],customQuotes:[...(raw.customQuotes||[])],favoriteQuotes:[...(raw.favoriteQuotes||[])],quoteHistory:{...(raw.quoteHistory||{})},cycle:{...defaultState().cycle,...(raw.cycle||{})},timeCapsules:{...(raw.timeCapsules||{})},lastBackupAt:raw.lastBackupAt||'',flourFavorites:[...(raw.flourFavorites||[])],flourRecent:[...(raw.flourRecent||[])],customFlourFoods:[...(raw.customFlourFoods||[])],routineChecks:{...(raw.routineChecks||{})}}}catch{return defaultState()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function toast(msg='저장되었습니다.'){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600)}
function recordScore(r){
  if(!r)return null;
  const trouble = r.troubleMode==='count' ? clamp(Number(r.troubleCount||0)/10*4,0,4) : Number(r.troubleLevel||0);
  const negatives=trouble+Number(r.redness||0)+Number(r.dryness||0)+Number(r.itch||0)+Number(r.oil||0);
  let score=100-negatives*4.2;
  if(Number(r.sleep)>=7) score+=3; else if(Number(r.sleep)<5) score-=4;
  if(Number(r.water)>=1.5) score+=2;
  return clamp(Math.round(score),0,100);
}
const levels=['없음','약간','보통','심함'];
const groups={
  troubleLevel:levels,redness:levels,dryness:levels,itch:levels,oil:levels,
  flour:['안 먹음','조금 먹음','먹음']
};

/* =========================================================
   Flour Encyclopedia Module
   ========================================================= */
const flourCategoryMeta={
  all:'전체',bread:'빵·베이커리',noodle:'면류',dessert:'과자·디저트',
  fried:'튀김',snack:'분식',processed:'가공식품',sauce:'소스·양념',
  cereal:'시리얼·곡물',dining:'외식 메뉴',alternative:'대체식품',
  ingredient:'성분'
};
const flourStatusMeta={
  contains:{label:'밀가루 포함',cls:'contains',level:2},
  check:{label:'제품 확인 필요',cls:'check',level:1},
  safe:{label:'대체·안심',cls:'safe',level:0}
};

let selectedFlourCategory='all';
let flourFavoritesOnly=false;
let selectedRecordFoods=[];

function allFlourFoods(){
  return [...(window.FLOUR_FOODS||[]),...(state.customFlourFoods||[])];
}
function flourFoodById(id){
  return allFlourFoods().find(food=>food.id===id);
}
function flourFoodMeta(food){
  return flourStatusMeta[food?.status]||flourStatusMeta.check;
}
function flourMatches(food,query){
  const normalized=String(query||'').trim().toLowerCase();
  if(!normalized)return true;
  // 검색 결과가 대체 음식 설명에 끌려오지 않도록
  // 음식명·별칭·확인 성분만 검색합니다.
  const searchable=[food.name,food.aliases,food.ingredients]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return searchable.includes(normalized);
}
function addRecentFlour(term){
  term=String(term||'').trim();
  if(!term)return;
  state.flourRecent=[
    term,...(state.flourRecent||[]).filter(item=>item!==term)
  ].slice(0,8);
  save();
}
function toggleFlourFavorite(id){
  const favorites=state.flourFavorites||[];
  state.flourFavorites=favorites.includes(id)
    ? favorites.filter(item=>item!==id)
    : [...favorites,id];
  save();
  renderFlourpedia();
}
function renderFlourCategories(){
  const box=document.getElementById('flourCategories');
  if(!box)return;
  const categories=[
    'all','bread','noodle','dessert','fried','snack','processed',
    'sauce','cereal','dining','alternative','ingredient'
  ];
  box.innerHTML='';
  categories.forEach(category=>{
    const button=document.createElement('button');
    button.className='flour-cat'+(
      selectedFlourCategory===category?' active':''
    );
    button.textContent=flourCategoryMeta[category];
    button.addEventListener('click',()=>{
      selectedFlourCategory=category;
      renderFlourpedia();
    });
    box.appendChild(button);
  });
}
function renderFlourRecent(){
  const wrap=document.getElementById('flourRecentWrap');
  const box=document.getElementById('flourRecent');
  if(!wrap||!box)return;
  const items=state.flourRecent||[];
  wrap.hidden=!items.length;
  box.innerHTML='';
  items.forEach(query=>{
    const button=document.createElement('button');
    button.className='recent-search';
    button.textContent=query;
    button.addEventListener('click',()=>{
      const input=document.getElementById('flourSearch');
      if(input)input.value=query;
      renderFlourpedia();
    });
    box.appendChild(button);
  });
}
function showFlourDetail(food){
  const box=document.getElementById('flourDetail');
  if(!box||!food)return;
  const meta=flourFoodMeta(food);
  const favorite=(state.flourFavorites||[]).includes(food.id);
  box.innerHTML=`
    <div class="metric">
      <span class="flour-status ${meta.cls}">${meta.label}</span>
      <button class="flour-fav" id="detailFlourFav">${favorite?'♥':'♡'}</button>
    </div>
    <h2>${food.name}</h2>
    <div class="flour-meta-row">
      <span class="flour-chip">${flourCategoryMeta[food.category]||'직접 추가'}</span>
    </div>
    <div class="flour-detail-section">
      <b>확인할 성분</b><p>${food.ingredients}</p>
    </div>
    <div class="flour-detail-section">
      <b>추천 대체 음식</b><p>${food.alternatives}</p>
    </div>
    <div class="flour-detail-section">
      <b>주의사항</b><p>${food.note}</p>
    </div>
    <div class="actions">
      <button class="primary" id="addDetailToToday">오늘 먹은 음식에 추가</button>
    </div>`;
  document.getElementById('detailFlourFav')?.addEventListener(
    'click',()=>toggleFlourFavorite(food.id)
  );
  document.getElementById('addDetailToToday')?.addEventListener('click',()=>{
    addFoodToRecord(food.id);
    showTab('record');
    toast('오늘 음식 기록에 추가했습니다.');
  });
}
function renderFlourpedia(){
  const list=document.getElementById('flourList');
  const count=document.getElementById('flourResultCount');
  if(!list||!count)return;

  renderFlourCategories();
  renderFlourRecent();

  const query=(document.getElementById('flourSearch')?.value||'').trim();
  let foods=allFlourFoods().filter(food=>{
    const categoryMatch=
      selectedFlourCategory==='all'||food.category===selectedFlourCategory;
    const queryMatch=!query||flourMatches(food,query);
    return categoryMatch&&queryMatch;
  });

  if(flourFavoritesOnly){
    foods=foods.filter(food=>(state.flourFavorites||[]).includes(food.id));
  }
  foods=foods.slice(0,300);
  count.textContent=`${foods.length}개 음식`;
  list.innerHTML='';

  if(!foods.length){
    list.innerHTML='<div class="flour-empty">검색 결과가 없습니다. 직접 음식 추가를 이용해 보세요.</div>';
    return;
  }

  foods.forEach(food=>{
    const meta=flourFoodMeta(food);
    const favorite=(state.flourFavorites||[]).includes(food.id);
    const item=document.createElement('div');
    item.className='flour-item';
    item.innerHTML=`
      <div>
        <h3>${food.name}</h3>
        <p>${flourCategoryMeta[food.category]||'직접 추가'} · ${food.alternatives}</p>
      </div>
      <div class="flour-item-actions">
        <span class="flour-status ${meta.cls}">${meta.label}</span>
        <button class="flour-fav">${favorite?'♥':'♡'}</button>
      </div>`;
    item.addEventListener('click',event=>{
      if(event.target.closest('.flour-fav'))return;
      if(query)addRecentFlour(query);
      showFlourDetail(food);
    });
    item.querySelector('.flour-fav')?.addEventListener('click',event=>{
      event.stopPropagation();
      toggleFlourFavorite(food.id);
    });
    list.appendChild(item);
  });
}
function setFlourLevel(level){
  current.flour=level;
  const group=document.querySelector('[data-group="flour"]');
  if(group){
    [...group.children].forEach((button,index)=>{
      button.classList.toggle('selected',index===level);
    });
  }
}
function updateFlourFromSelectedFoods(){
  const foods=selectedRecordFoods.map(flourFoodById).filter(Boolean);
  if(!foods.length)return;
  setFlourLevel(Math.max(...foods.map(food=>flourFoodMeta(food).level)));
}
function addFoodToRecord(id){
  if(!id||selectedRecordFoods.includes(id))return;
  selectedRecordFoods.push(id);
  updateFlourFromSelectedFoods();
  renderSelectedRecordFoods();
}
function removeFoodFromRecord(id){
  selectedRecordFoods=selectedRecordFoods.filter(item=>item!==id);
  renderSelectedRecordFoods();
}
function renderSelectedRecordFoods(){
  const box=document.getElementById('selectedRecordFoods');
  if(!box)return;
  box.innerHTML='';
  selectedRecordFoods.forEach(id=>{
    const food=flourFoodById(id);
    if(!food)return;
    const chip=document.createElement('span');
    chip.className='selected-food';
    chip.innerHTML=`${food.name}<button type="button" aria-label="삭제">×</button>`;
    chip.querySelector('button')?.addEventListener(
      'click',()=>removeFoodFromRecord(id)
    );
    box.appendChild(chip);
  });
}
function renderRecordFoodResults(){
  const input=document.getElementById('recordFoodSearch');
  const box=document.getElementById('recordFoodResults');
  if(!input||!box)return;
  const query=input.value.trim();
  if(!query){
    box.classList.remove('show');
    box.innerHTML='';
    return;
  }
  const foods=allFlourFoods()
    .filter(food=>flourMatches(food,query))
    .slice(0,8);
  box.innerHTML='';
  foods.forEach(food=>{
    const meta=flourFoodMeta(food);
    const button=document.createElement('button');
    button.type='button';
    button.className='food-picker-result';
    button.innerHTML=`
      <span>${food.name}</span>
      <span class="flour-status ${meta.cls}">${meta.label}</span>`;
    button.addEventListener('click',()=>{
      addFoodToRecord(food.id);
      input.value='';
      box.classList.remove('show');
    });
    box.appendChild(button);
  });
  box.classList.toggle('show',foods.length>0);
}
function renderFoodPatternAnalysis(){
  const box=document.getElementById('foodPatternAnalysis');
  if(!box)return;

  const records=lastNDays(30);
  const counts={};
  records.forEach(record=>{
    (record.eatenFoods||[]).forEach(id=>{
      counts[id]=(counts[id]||0)+1;
    });
  });

  const rows=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8);

  box.innerHTML='';
  if(!rows.length){
    box.innerHTML='<p class="sub">음식을 기록하면 자주 먹은 음식과 다음날 피부 변화를 보여드립니다.</p>';
    return;
  }

  rows.forEach(([id,count])=>{
    const food=flourFoodById(id);
    if(!food)return;

    let compared=0;
    let increased=0;
    records
      .filter(record=>(record.eatenFoods||[]).includes(id))
      .forEach(record=>{
        const next=state.records[addDays(record.date,1)];
        if(!next)return;
        compared++;
        const before=record.troubleMode==='count'
          ? record.troubleCount : record.troubleLevel;
        const after=next.troubleMode==='count'
          ? next.troubleCount : next.troubleLevel;
        if(after>before)increased++;
      });

    const row=document.createElement('div');
    row.className='food-analysis-row';
    row.innerHTML=`
      <span>${food.name} · ${count}회</span>
      <b>${compared?`다음날 증가 ${increased}/${compared}회`:'비교 기록 부족'}</b>`;
    box.appendChild(row);
  });
}
function bindFlourpediaControls(){
  const search=document.getElementById('flourSearch');
  if(search&&!search.dataset.bound){
    search.dataset.bound='1';
    search.addEventListener('input',renderFlourpedia);
  }

  const clear=document.getElementById('clearFlourSearch');
  if(clear&&!clear.dataset.bound){
    clear.dataset.bound='1';
    clear.addEventListener('click',()=>{
      const input=document.getElementById('flourSearch');
      if(input)input.value='';
      selectedFlourCategory='all';
      flourFavoritesOnly=false;
      const favoriteButton=document.getElementById('showFlourFavorites');
      if(favoriteButton)favoriteButton.textContent='즐겨찾기만 보기';
      renderFlourpedia();
    });
  }

  const favoriteButton=document.getElementById('showFlourFavorites');
  if(favoriteButton&&!favoriteButton.dataset.bound){
    favoriteButton.dataset.bound='1';
    favoriteButton.addEventListener('click',()=>{
      flourFavoritesOnly=!flourFavoritesOnly;
      favoriteButton.textContent=flourFavoritesOnly
        ? '전체 음식 보기' : '즐겨찾기만 보기';
      renderFlourpedia();
    });
  }

  const addCustom=document.getElementById('addCustomFood');
  if(addCustom&&!addCustom.dataset.bound){
    addCustom.dataset.bound='1';
    addCustom.addEventListener('click',()=>{
      const name=document.getElementById('customFoodName')?.value.trim();
      const status=document.getElementById('customFoodStatus')?.value||'check';
      if(!name){
        toast('음식명을 입력해 주세요.');
        return;
      }
      const food={
        id:`custom-${Date.now()}`,
        name,
        category:'processed',
        status,
        ingredients:'직접 추가한 음식입니다. 제품 성분표를 확인하세요.',
        alternatives:'직접 선택한 대체 음식을 메모에 기록해 보세요.',
        note:'직접 추가한 항목',
        aliases:'직접 추가'
      };
      state.customFlourFoods.push(food);
      save();
      document.getElementById('customFoodName').value='';
      renderFlourpedia();
      showFlourDetail(food);
      toast('내 음식에 추가했습니다.');
    });
  }

  const recordSearch=document.getElementById('recordFoodSearch');
  if(recordSearch&&!recordSearch.dataset.bound){
    recordSearch.dataset.bound='1';
    recordSearch.addEventListener('input',renderRecordFoodResults);
    recordSearch.addEventListener('focus',renderRecordFoodResults);
  }
}
document.addEventListener('click',event=>{
  if(!event.target.closest('.food-picker-search')){
    document.getElementById('recordFoodResults')?.classList.remove('show');
  }
});

let current={troubleLevel:0,redness:0,dryness:0,itch:0,oil:0,flour:0};
let selectedRecordDate=today();
let selectedMood='🙂';
const moodValues=['😀','🙂','😐','😔','😣','❤️'];
const moodBox=document.getElementById('moodOptions');
moodValues.forEach(m=>{const b=document.createElement('button');b.textContent=m;b.onclick=()=>{selectedMood=m;[...moodBox.children].forEach(x=>x.classList.toggle('selected',x===b))};moodBox.appendChild(b)});
document.querySelectorAll('[data-group]').forEach(el=>{
  const g=el.dataset.group;
  groups[g].forEach((label,i)=>{
    const b=document.createElement('button');b.className='option';b.textContent=label;b.onclick=()=>{current[g]=i;[...el.children].forEach((x,j)=>x.classList.toggle('selected',j===i))};el.appendChild(b)
  })
});
function selectGroups(r={}){
  Object.keys(groups).forEach(g=>{current[g]=Number(r[g]??0);const el=document.querySelector(`[data-group="${g}"]`);[...el.children].forEach((x,j)=>x.classList.toggle('selected',j===current[g]))})
}
selectGroups();

function showTab(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='analysis') renderAnalysis();
  if(id==='history'){renderHistory();renderCompareOptions();bindBackupAndCompareControls();}
  if(id==='goals') renderGoals();
  if(id==='growth') renderGrowth();
  if(id==='quotes') renderQuoteLibrary();
  if(id==='settings'){renderSettings();renderBackupCenter();bindBackupAndCompareControls();}
  if(id==='cycle') renderCycle();
  if(id==='flourpedia'){renderFlourpedia();bindFlourpediaControls();}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showTab(b.dataset.go));

document.getElementById('todayBtn').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date());

document.getElementById('troubleMode').onchange=e=>{
  document.getElementById('troubleCountWrap').style.display=e.target.value==='count'?'block':'none';
  document.getElementById('troubleLevelWrap').style.display=e.target.value==='level'?'block':'none';
};
['sleep','water'].forEach(id=>document.getElementById(id).oninput=()=>{
  document.getElementById(id+'Text').textContent=id==='sleep'?`${document.getElementById(id).value}시간`:`${document.getElementById(id).value}L`
});
document.getElementById('goalProgress').oninput=e=>document.getElementById('goalProgressEditText').textContent=e.target.value+'%';


let cropState={image:null,mode:'goal',ratio:1.7778,zoom:1,rotation:0,flip:false,offsetX:0,offsetY:0,dragging:false,lastX:0,lastY:0,returnView:'home'};
const cropCanvas=document.getElementById('cropCanvas'),cropCtx=cropCanvas.getContext('2d');
function beginCrop(file,mode='goal'){
  if(!file)return;
  const active=document.querySelector('.view.active');
  const returnView=active?active.id:'home';
  const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      cropState={image:img,mode,ratio:mode==='goal'?1.7778:1,zoom:1,rotation:0,flip:false,offsetX:0,offsetY:0,dragging:false,lastX:0,lastY:0,returnView};
      document.querySelectorAll('#ratioOptions button').forEach(b=>b.classList.toggle('active',Number(b.dataset.ratio)===cropState.ratio));
      document.getElementById('cropZoom').value=1;document.getElementById('cropZoomText').textContent='1.0×';
      document.getElementById('cropRotation').value=0;document.getElementById('cropRotationText').textContent='0°';
      document.getElementById('cropModal').classList.add('show');document.body.classList.add('modal-open');document.querySelector('nav')?.classList.add('modal-hidden');drawCrop();
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
}
function cropArea(){
  const w=cropCanvas.width,h=cropCanvas.height,pad=.08;
  let cw=w*(1-pad*2),ch=cw/cropState.ratio;
  if(ch>h*(1-pad*2)){ch=h*(1-pad*2);cw=ch*cropState.ratio}
  return {x:(w-cw)/2,y:(h-ch)/2,w:cw,h:ch};
}
function drawCrop(){
  if(!cropState.image)return;
  const c=cropCanvas,ctx=cropCtx,img=cropState.image,a=cropArea();
  const guide=document.getElementById('cropGuide');
  guide.style.left=(a.x/c.width*100)+'%';guide.style.top=(a.y/c.height*100)+'%';
  guide.style.width=(a.w/c.width*100)+'%';guide.style.height=(a.h/c.height*100)+'%';
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#181818';ctx.fillRect(0,0,c.width,c.height);
  const angle=cropState.rotation*Math.PI/180;
  const rotW=Math.abs(img.width*Math.cos(angle))+Math.abs(img.height*Math.sin(angle));
  const rotH=Math.abs(img.width*Math.sin(angle))+Math.abs(img.height*Math.cos(angle));
  const base=Math.max(a.w/rotW,a.h/rotH);
  const scale=base*cropState.zoom;
  ctx.save();ctx.translate(c.width/2+cropState.offsetX,c.height/2+cropState.offsetY);ctx.rotate(angle);ctx.scale(cropState.flip?-scale:scale,scale);
  ctx.drawImage(img,-img.width/2,-img.height/2);ctx.restore();
}
function pointerPos(e){const r=cropCanvas.getBoundingClientRect();return {x:(e.clientX-r.left)*cropCanvas.width/r.width,y:(e.clientY-r.top)*cropCanvas.height/r.height}}
cropCanvas.addEventListener('pointerdown',e=>{cropState.dragging=true;const p=pointerPos(e);cropState.lastX=p.x;cropState.lastY=p.y;cropCanvas.setPointerCapture(e.pointerId)});
cropCanvas.addEventListener('pointermove',e=>{if(!cropState.dragging)return;const p=pointerPos(e);cropState.offsetX+=p.x-cropState.lastX;cropState.offsetY+=p.y-cropState.lastY;cropState.lastX=p.x;cropState.lastY=p.y;drawCrop()});
cropCanvas.addEventListener('pointerup',()=>cropState.dragging=false);
document.querySelectorAll('#ratioOptions button').forEach(b=>b.onclick=()=>{cropState.ratio=Number(b.dataset.ratio);document.querySelectorAll('#ratioOptions button').forEach(x=>x.classList.toggle('active',x===b));drawCrop()});
document.getElementById('cropZoom').oninput=e=>{cropState.zoom=Number(e.target.value);document.getElementById('cropZoomText').textContent=cropState.zoom.toFixed(1)+'×';drawCrop()};
document.getElementById('cropRotation').oninput=e=>{cropState.rotation=Number(e.target.value);document.getElementById('cropRotationText').textContent=cropState.rotation+'°';drawCrop()};
document.getElementById('cropRotateLeft').onclick=()=>{cropState.rotation=(cropState.rotation-90)%360;document.getElementById('cropRotation').value=cropState.rotation;document.getElementById('cropRotationText').textContent=cropState.rotation+'°';drawCrop()};
document.getElementById('cropFlip').onclick=()=>{cropState.flip=!cropState.flip;drawCrop()};
document.getElementById('cropReset').onclick=()=>{cropState.zoom=1;cropState.rotation=0;cropState.flip=false;cropState.offsetX=0;cropState.offsetY=0;document.getElementById('cropZoom').value=1;document.getElementById('cropRotation').value=0;document.getElementById('cropZoomText').textContent='1.0×';document.getElementById('cropRotationText').textContent='0°';drawCrop()};
function closeCrop(){document.getElementById('cropModal').classList.remove('show');document.body.classList.remove('modal-open');document.querySelector('nav')?.classList.remove('modal-hidden')}
document.getElementById('closeCrop').onclick=closeCrop;
document.getElementById('cropModal').onclick=e=>{if(e.target.id==='cropModal')closeCrop()};
document.getElementById('cropSave').onclick=()=>{
  if(!cropState.image)return;
  const a=cropArea(),out=document.createElement('canvas');
  const targetW=cropState.ratio>=1?1200:900,targetH=Math.round(targetW/cropState.ratio);
  out.width=targetW;out.height=targetH;
  const o=out.getContext('2d');
  o.drawImage(cropCanvas,a.x,a.y,a.w,a.h,0,0,out.width,out.height);
  const item={id:crypto.randomUUID(),src:out.toDataURL('image/jpeg',.88),date:today(),ratio:cropState.ratio};
  if(cropState.mode==='goal')state.goalPhotos.unshift(item);else state.actualPhotos.unshift(item);
  save();closeCrop();renderAll();
  ['goalUpload','goalUploadHome','actualUpload','actualUploadHistory'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  if(cropState.mode==='goal'){
    if(cropState.returnView==='goals')showTab('goals');else showTab('home');
    toast('자른 사진을 대표 목표 사진으로 적용했습니다.');
  }else{
    showTab(cropState.returnView==='history'?'history':'record');
    toast('자른 피부 사진을 저장했습니다.');
  }
};
document.getElementById('goalUpload').onchange=e=>beginCrop(e.target.files[0],'goal');
document.getElementById('goalUploadHome').onchange=e=>beginCrop(e.target.files[0],'goal');
document.getElementById('actualUpload').onchange=e=>beginCrop(e.target.files[0],'actual');
document.getElementById('actualUploadHistory').onchange=e=>beginCrop(e.target.files[0],'actual');


document.getElementById('saveGoals').onclick=()=>{
  state.goalReason=document.getElementById('goalReason').value.trim()||'이 피부를 향해, 오늘도 한 걸음.';
  state.futureLetter=document.getElementById('futureLetter').value.trim();
  state.startDate=document.getElementById('startDate').value||today();
  state.goalProgress=Number(document.getElementById('goalProgress').value);
  save();renderAll();toast();
};


function formatModified(iso){
  if(!iso)return '';
  const d=new Date(iso);
  return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
}
function blankRecordForm(){
  document.getElementById('troubleMode').value='count';
  document.getElementById('troubleMode').dispatchEvent(new Event('change'));
  document.getElementById('troubleCount').value=0;
  selectGroups({});
  document.getElementById('sleep').value=7;
  document.getElementById('sleepText').textContent='7시간';
  document.getElementById('water').value=1.5;
  document.getElementById('waterText').textContent='1.5L';
  document.getElementById('period').value='none';
  document.getElementById('memo').value='';
  selectedMood='🙂';[...moodBox.children].forEach(b=>b.classList.toggle('selected',b.textContent===selectedMood));
  document.getElementById('diaryLine').value='';document.getElementById('selfMessage').value='';selectedRecordFoods=[];renderSelectedRecordFoods();const recordFoodSearch=document.getElementById('recordFoodSearch');if(recordFoodSearch)recordFoodSearch.value='';
}
function loadRecordDate(date){
  selectedRecordDate=date;
  document.getElementById('recordDate').value=date;
  const r=state.records[date];
  const isToday=date===today();
  document.getElementById('recordTitle').textContent=isToday?'오늘의 피부 상태':`${date} 피부 상태`;
  const status=document.getElementById('recordStatus');
  const saveBtn=document.getElementById('saveRecord');
  const delBtn=document.getElementById('deleteRecord');
  if(r){
    document.getElementById('troubleMode').value=r.troubleMode;
    document.getElementById('troubleMode').dispatchEvent(new Event('change'));
    document.getElementById('troubleCount').value=r.troubleCount;
    selectGroups(r);
    document.getElementById('sleep').value=r.sleep;
    document.getElementById('sleepText').textContent=r.sleep+'시간';
    document.getElementById('water').value=r.water;
    document.getElementById('waterText').textContent=r.water+'L';
    document.getElementById('period').value=r.period;
    document.getElementById('memo').value=r.memo||'';
    selectedMood=r.mood||'🙂';[...moodBox.children].forEach(b=>b.classList.toggle('selected',b.textContent===selectedMood));
    document.getElementById('diaryLine').value=r.diaryLine||'';document.getElementById('selfMessage').value=r.selfMessage||'';selectedRecordFoods=[...(r.eatenFoods||[])];renderSelectedRecordFoods();
    status.className='record-status saved';
    status.textContent=`저장 완료 ✓${r.modifiedAt?' · 마지막 수정 '+formatModified(r.modifiedAt):''}`;
    saveBtn.textContent=isToday?'오늘 기록 수정':'이 기록 수정';
    delBtn.style.display='inline-block';
  }else{
    blankRecordForm();
    status.className='record-status';
    status.textContent='아직 저장하지 않음';
    saveBtn.textContent=isToday?'오늘 기록 저장':'이 날짜 기록 저장';
    delBtn.style.display='none';
  }
}
document.getElementById('recordDate').onchange=e=>loadRecordDate(e.target.value||today());

document.getElementById('saveRecord').onclick=()=>{
  const date=selectedRecordDate||today();
  const existed=!!state.records[date];
  const now=new Date().toISOString();
  const r={
    date,
    troubleMode:document.getElementById('troubleMode').value,
    troubleCount:Number(document.getElementById('troubleCount').value||0),
    ...current,
    sleep:Number(document.getElementById('sleep').value),
    water:Number(document.getElementById('water').value),
    period:document.getElementById('period').value,
    memo:document.getElementById('memo').value.trim(),
    mood:selectedMood,diaryLine:document.getElementById('diaryLine').value.trim(),selfMessage:document.getElementById('selfMessage').value.trim(),eatenFoods:[...selectedRecordFoods],
    createdAt:state.records[date]?.createdAt||now,
    modifiedAt:now
  };
  r.score=recordScore(r);
  state.records[date]=r;
  if(date===today()){
    state.checks[date]={...(state.checks[date]||{}),flourFree:r.flour===0,waterDone:r.water>=1.5,sleepDone:true,skinDone:true};
    state.routineChecks=state.routineChecks||{};
    state.routineChecks[date]={...(state.routineChecks[date]||{})};
    const autoTime=`${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;
    if(r.water>=2)state.routineChecks[date].water2L=state.routineChecks[date].water2L||autoTime;
    if(r.flour===0)state.routineChecks[date].flourFree=state.routineChecks[date].flourFree||autoTime;
  }
  save();renderAll();loadRecordDate(date);
  toast(existed?'기록을 수정했습니다.':'기록을 저장했습니다.');
};

document.getElementById('deleteRecord').onclick=()=>{
  const date=selectedRecordDate||today();
  if(!state.records[date])return;
  if(!confirm(`${date} 기록을 삭제할까요?`))return;
  delete state.records[date];
  if(state.checks[date])delete state.checks[date];
  save();renderAll();loadRecordDate(date);
  toast('기록을 삭제했습니다.');
};


document.querySelectorAll('[data-check]').forEach(c=>c.onchange=()=>{
  state.checks[today()]={...(state.checks[today()]||{}),[c.dataset.check]:c.checked};save()
});

function streak(){
  let n=0,d=today();
  while(state.records[d] && state.records[d].flour===0){n++;d=addDays(d,-1)}
  return n;
}
function lastNDays(n){
  const start=addDays(today(),-(n-1));
  return Object.values(state.records).filter(r=>r.date>=start&&r.date<=today()).sort((a,b)=>a.date.localeCompare(b.date));
}

const homeSubQuotes=[
  '오늘의 작은 선택이, 미래의 당신을 만듭니다.',
  '피부는 기록한 사람에게 답을 합니다.',
  '오늘도 어제보다 조금 더 좋아지고 있습니다.',
  '포기하지 않는 하루가 피부를 바꿉니다.',
  '당신의 피부는 오늘도 회복하고 있습니다.',
  '미래의 나는 오늘의 나에게 고마워할 것입니다.',
  '작은 습관 하나가 큰 변화를 만듭니다.',
  '완벽함보다 꾸준함이 더 강합니다.',
  '오늘의 기록이 내일의 자신감을 만듭니다.'
];
function homeSubQuoteForToday(){
  const day=new Date().getDay();
  const encouragement=homeSubQuotes.filter((_,i)=>i%3===0);
  const affirmation=homeSubQuotes.filter((_,i)=>i%3===1);
  const future=homeSubQuotes.filter((_,i)=>i%3===2);
  const pool=day===1||day===4?encouragement:day===2||day===5?affirmation:day===3||day===6?future:homeSubQuotes;
  return pool[hashDate(today()+'home-sub')%pool.length];
}


const dailyRoutineItems=[
  {id:'berberSmoothie',label:'베르베르 스무디'},
  {id:'phyto',label:'파이토'},
  {id:'bromelain',label:'브로멜라인'},
  {id:'pantothenic',label:'판토텐산'},
  {id:'monoOrange',label:'모노오렌지'},
  {id:'water2L',label:'물 2L'},
  {id:'flourFree',label:'오늘 무밀가루'}
];

function routineForDate(date=today()){
  return state.routineChecks?.[date]||{};
}
function routineDoneCount(date=today()){
  const checks=routineForDate(date);
  return dailyRoutineItems.filter(item=>!!checks[item.id]).length;
}
function routineStreak(){
  let count=0;
  let date=today();
  while(routineDoneCount(date)===dailyRoutineItems.length){
    count++;
    date=addDays(date,-1);
  }
  return count;
}
function formatRoutineTime(value){
  if(!value)return '미완료';
  if(typeof value==='string'&&/^\d{2}:\d{2}$/.test(value))return `완료 ${value}`;
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime()))return '완료';
  return `완료 ${String(parsed.getHours()).padStart(2,'0')}:${String(parsed.getMinutes()).padStart(2,'0')}`;
}
function renderDailyRoutine(){
  const checks=routineForDate();
  document.querySelectorAll('[data-routine]').forEach(input=>{
    const id=input.dataset.routine;
    input.checked=!!checks[id];
    const time=document.querySelector(`[data-routine-time="${id}"]`);
    if(time)time.textContent=formatRoutineTime(checks[id]);
  });
  const done=routineDoneCount();
  const total=dailyRoutineItems.length;
  const percent=Math.round(done/total*100);
  const progressText=document.getElementById('routineProgressText');
  const progressBar=document.getElementById('routineProgressBar');
  const message=document.getElementById('routineCompleteMessage');
  const streakText=document.getElementById('routineStreakText');
  if(progressText)progressText.textContent=`${done} / ${total}`;
  if(progressBar)progressBar.style.width=percent+'%';
  if(message){
    message.textContent=done===total
      ? '🎉 오늘 피부 루틴을 모두 완료했어요!'
      : done===0
        ? '하나씩 체크하며 오늘의 루틴을 완성해 보세요.'
        : `오늘 루틴 ${percent}% 완료했어요.`;
  }
  if(streakText)streakText.textContent=`연속 완료 ${routineStreak()}일`;
}
function bindDailyRoutine(){
  document.querySelectorAll('[data-routine]').forEach(input=>{
    if(input.dataset.bound)return;
    input.dataset.bound='1';
    input.addEventListener('change',()=>{
      const date=today();
      state.routineChecks=state.routineChecks||{};
      state.routineChecks[date]={...(state.routineChecks[date]||{})};
      if(input.checked){
        const now=new Date();
        state.routineChecks[date][input.dataset.routine]=
          `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      }else{
        delete state.routineChecks[date][input.dataset.routine];
      }
      save();
      renderDailyRoutine();
      if(routineDoneCount()===dailyRoutineItems.length){
        toast('오늘 피부 루틴 100% 완료!');
      }
    });
  });
}
function renderHomeMission(){
  const mission=chooseMission();
  const card=document.getElementById('homeMissionCard');
  if(!card)return;
  card.classList.toggle('lucky',!!mission.lucky);
  const tag=document.getElementById('homeMissionTag');
  const xp=document.getElementById('homeMissionXP');
  const icon=document.getElementById('homeMissionIcon');
  const title=document.getElementById('homeMissionTitle');
  const reason=document.getElementById('homeMissionReason');
  const button=document.getElementById('completeHomeMission');
  const done=document.getElementById('homeMissionDone');
  if(tag)tag.textContent=mission.lucky?'🎁 오늘의 럭키 미션':'🌱 오늘의 랜덤 미션';
  if(xp)xp.textContent=`+${mission.xp} XP`;
  if(icon)icon.textContent=mission.icon||(mission.lucky?'🎁':'🌱');
  if(title)title.textContent=mission.title;
  if(reason)reason.textContent=mission.lucky
    ? '오늘은 특별 보상 2배 미션이 등장했어요.'
    : '매일 달라지는 작은 미션으로 피부 습관을 만들어 보세요.';
  if(button)button.hidden=!!mission.done;
  if(done)done.hidden=!mission.done;
}
function completeTodayMission(){
  const mission=chooseMission();
  if(mission.done)return;
  mission.done=true;
  mission.completedAt=new Date().toISOString();
  state.xp=Number(state.xp||0)+mission.xp;
  state.missions[today()]=mission;
  state.missionHistory.push({...mission});
  save();
  renderAll();
  toast(`미션 완료! +${mission.xp} XP`);
}
function bindHomeMission(){
  const button=document.getElementById('completeHomeMission');
  if(button&&!button.dataset.bound){
    button.dataset.bound='1';
    button.addEventListener('click',completeTodayMission);
  }
}

function renderHome(){
  const journeyDays=Math.max(1,diffDays(state.startDate,today())+1);
  const journeyDayEl=document.getElementById('journeyDay');
  if(journeyDayEl)journeyDayEl.textContent='DAY '+journeyDays;
  const homeSubQuoteEl=document.getElementById('homeSubQuote');
  if(homeSubQuoteEl)homeSubQuoteEl.textContent=homeSubQuoteForToday();
  const photos=state.goalPhotos;
  const hero=document.getElementById('goalHero');
  const old=hero.querySelector('img');if(old)old.remove();
  hero.classList.remove('portrait','square','landscape');
  const placeholder=document.getElementById('goalPlaceholder');
  if(photos.length){
    const photo=photos[0],ratio=Number(photo.ratio||1.7778),img=document.createElement('img');
    img.src=photo.src;img.alt='대표 목표 피부 사진';
    hero.classList.add(ratio<0.9?'portrait':ratio<1.2?'square':'landscape');
    hero.prepend(img);placeholder.style.display='none';
  } else placeholder.style.display='block';
  document.getElementById('goalReasonHome').textContent=state.goalReason;
  document.getElementById('goalCountHome').textContent=`목표 사진 ${photos.length}장`;
  const r=state.records[today()], score=r?.score;
  document.getElementById('homeScore').innerHTML=score!=null?`${score}<small>점</small>`:'--<small>점</small>';
  const label=score==null?'기록 전':score>=90?'매우 좋음':score>=80?'좋음':score>=70?'보통':'주의';
  document.getElementById('scoreLabel').textContent=label;
  const prev=state.records[addDays(today(),-1)]?.score;
  document.getElementById('scoreDiff').textContent=score==null?'오늘 기록을 완료하면 자동 계산됩니다.':prev==null?'첫 기록이 저장되었습니다.':`어제보다 ${score-prev>=0?'+':''}${score-prev}점`;
  document.getElementById('goalProgressText').textContent=state.goalProgress+'%';
  document.getElementById('goalProgressBar').style.width=state.goalProgress+'%';
  const days=clamp(diffDays(state.startDate,today())+1,1,9999);
  document.getElementById('dayCount').textContent=days;
  document.getElementById('streak').textContent=streak();
  document.getElementById('monthSuccess').textContent=lastNDays(30).filter(r=>r.flour===0).length;
  [[30,'p30'],[90,'p90'],[365,'p365']].forEach(([n,id])=>{const p=clamp(Math.round(days/n*100),0,100);document.getElementById(id).style.width=p+'%';document.getElementById(id+'Text').textContent=p+'%'});
  const checks=state.checks[today()]||{};
  document.querySelectorAll('[data-check]').forEach(c=>c.checked=!!checks[c.dataset.check]);
  renderDailyRoutine();
  renderHomeMission();
  bindDailyRoutine();
  bindHomeMission();
}
function renderGoals(){
  document.getElementById('goalReason').value=state.goalReason||'';
  document.getElementById('futureLetter').value=state.futureLetter||'';
  document.getElementById('startDate').value=state.startDate||today();
  document.getElementById('goalProgress').value=state.goalProgress||0;
  document.getElementById('goalProgressEditText').textContent=(state.goalProgress||0)+'%';

  const box=document.getElementById('goalPhotos');
  box.innerHTML='';

  // Older saved photos may not have an id. Add one once so selection remains stable.
  let idsAdded=false;
  (state.goalPhotos||[]).forEach((p,i)=>{
    if(!p.id){p.id='goal-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2);idsAdded=true}
  });
  if(idsAdded)save();

  const representativeId=state.goalPhotos?.[0]?.id||null;
  const groups={};
  (state.goalPhotos||[]).forEach(photo=>{
    const date=photo.date||today();
    (groups[date]||(groups[date]=[])).push(photo);
  });

  const dates=Object.keys(groups).sort((a,b)=>b.localeCompare(a));
  if(!dates.length){
    box.innerHTML='<div class="analysis-box"><b>아직 저장된 목표 사진이 없습니다.</b><p class="sub slim">사진 추가 버튼으로 첫 사진을 등록해 보세요.</p></div>';
    return;
  }

  const selectPhoto=(photoId)=>{
    const currentIndex=state.goalPhotos.findIndex(p=>p.id===photoId);
    if(currentIndex<0)return;

    // Update the visible gallery immediately so the tap feels responsive.
    box.querySelectorAll('.goal-photo-item').forEach(card=>{
      const isSelected=card.dataset.photoId===photoId;
      card.classList.toggle('selected',isSelected);
      const check=card.querySelector('.select-photo');
      if(check)check.textContent=isSelected?'✓':'';
    });

    if(currentIndex!==0){
      const [chosen]=state.goalPhotos.splice(currentIndex,1);
      state.goalPhotos.unshift(chosen);
      save();
    }

    // Refresh only the parts that depend on the representative photo.
    renderHome();
    toast(currentIndex===0?'현재 대표 목표 사진입니다.':'대표 목표 사진으로 변경했습니다.');
  };

  dates.forEach(date=>{
    const section=document.createElement('section');
    section.className='goal-date-group';

    const title=document.createElement('div');
    title.className='goal-date-title';
    title.innerHTML=`<strong>${new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date+'T00:00:00'))}</strong><span>${groups[date].length}장</span>`;
    section.appendChild(title);

    const grid=document.createElement('div');
    grid.className='goal-date-grid';

    groups[date].forEach(photo=>{
      const selected=photo.id===representativeId;
      const item=document.createElement('div');
      item.className='goal-photo-item'+(selected?' selected':'');
      item.dataset.photoId=photo.id;
      item.innerHTML=`<img src="${photo.src}" alt="목표 피부 사진">
        <button type="button" class="delete-photo" aria-label="사진 삭제">×</button>
        <button type="button" class="select-photo" aria-label="대표 사진 선택">${selected?'✓':''}</button>`;

      item.querySelector('img').addEventListener('click',()=>selectPhoto(photo.id));
      item.querySelector('.select-photo').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectPhoto(photo.id)});
      item.querySelector('.delete-photo').addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(!confirm('이 목표 사진을 삭제할까요?'))return;
        const removeIndex=state.goalPhotos.findIndex(p=>p.id===photo.id);
        if(removeIndex>=0)state.goalPhotos.splice(removeIndex,1);
        save();renderAll();toast('사진을 삭제했습니다.');
      });

      grid.appendChild(item);
    });

    section.appendChild(grid);
    box.appendChild(section);
  });
}
function renderAnalysis(){
  const rec=lastNDays(30), map=state.records;
  const flour=rec.filter(r=>r.flour>0), no=rec.filter(r=>r.flour===0);
  document.getElementById('flourDays').textContent=flour.length;
  document.getElementById('noFlourDays').textContent=no.length;
  document.getElementById('records30').textContent=rec.length;
  let inc=0, noinc=0, afterScores=[];
  flour.forEach(r=>{
    const next=map[addDays(r.date,1)]; if(!next)return;
    afterScores.push(next.score);
    const curTrouble=r.troubleMode==='count'?r.troubleCount:r.troubleLevel;
    const nxtTrouble=next.troubleMode==='count'?next.troubleCount:next.troubleLevel;
    if(nxtTrouble>curTrouble)inc++;else noinc++;
  });
  document.getElementById('troubleIncrease').textContent=inc+'회';
  document.getElementById('troubleNoChange').textContent=noinc+'회';
  const a1=avg(no.map(r=>r.score)),a2=avg(afterScores);
  document.getElementById('avgNoFlour').textContent=a1==null?'--':a1+'점';
  document.getElementById('avgAfterFlour').textContent=a2==null?'--':a2+'점';
  const report=[];
  if(rec.length<7) report.push('최소 7일 이상 기록하면 자동 분석을 시작합니다.');
  else{
    const best=rec.slice().sort((a,b)=>b.score-a.score)[0];
    report.push(`최근 가장 높은 피부 점수는 ${best.score}점이었습니다.`);
    const goodSleep=rec.filter(r=>r.sleep>=7),lowSleep=rec.filter(r=>r.sleep<7);
    if(goodSleep.length&&lowSleep.length)report.push(`수면 7시간 이상인 날 평균은 ${avg(goodSleep.map(r=>r.score))}점, 7시간 미만은 ${avg(lowSleep.map(r=>r.score))}점입니다.`);
    if(flour.length)report.push(`밀가루를 먹은 날은 ${flour.length}일이며, 다음날 비교 가능한 기록은 ${inc+noinc}건입니다.`);
  }
  document.getElementById('autoReport').innerHTML=report.map(x=>`<p>${x}</p>`).join('');
  const formula=[];
  if(rec.length>=7){
    const highWater=rec.filter(r=>r.water>=1.5),lowWater=rec.filter(r=>r.water<1.5);
    if(highWater.length&&lowWater.length)formula.push(`물 1.5L 이상: 평균 ${avg(highWater.map(r=>r.score))}점 / 미만: ${avg(lowWater.map(r=>r.score))}점`);
    if(a1!=null&&a2!=null)formula.push(`무밀가루 기록일 평균 ${a1}점 / 섭취 다음날 평균 ${a2}점`);
    formula.push(`현재 연속 무밀가루 기록은 ${streak()}일입니다.`);
  }
  document.getElementById('formulaReport').innerHTML=formula.length?formula.map(x=>`<p>${x}</p>`).join(''):'최소 7일 이상 기록하면 패턴을 요약합니다.';
  drawChart(rec);renderFoodPatternAnalysis();
}
function drawChart(rec){
  const c=document.getElementById('scoreChart'),ctx=c.getContext('2d');const w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#eadfd9';ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=25+i*48;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(w-20,y);ctx.stroke()}
  if(!rec.length){ctx.fillStyle='#7b716b';ctx.font='16px sans-serif';ctx.fillText('기록이 없습니다.',40,60);return}
  ctx.strokeStyle='#d98973';ctx.lineWidth=4;ctx.beginPath();
  rec.forEach((r,i)=>{const x=40+i*((w-70)/Math.max(rec.length-1,1));const y=230-(r.score/100*200);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.stroke();ctx.fillStyle='#d98973';
  rec.forEach((r,i)=>{const x=40+i*((w-70)/Math.max(rec.length-1,1));const y=230-(r.score/100*200);ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill()})
}


function renderHistory(){
  renderDiary(document.getElementById('diaryList'),Object.values(state.records).sort((a,b)=>b.date.localeCompare(a.date)));
  const photos=document.getElementById('actualPhotos');photos.innerHTML='';
  state.actualPhotos.slice().reverse().forEach((p,ri)=>{
    const i=state.actualPhotos.length-1-ri,d=document.createElement('div');d.className='photo-card';d.innerHTML=`<img src="${p.src}"><button>×</button>`;
    d.querySelector('button').onclick=()=>{state.actualPhotos.splice(i,1);save();renderHistory()};photos.appendChild(d)
  });
  const list=document.getElementById('historyList');list.innerHTML='';
  Object.values(state.records).sort((a,b)=>b.date.localeCompare(a.date)).forEach(r=>{
    const d=document.createElement('div');d.className='history-row';
    const flour=['안 먹음','조금','먹음'][r.flour];
    d.innerHTML=`<span>${r.date.slice(5)}</span><span>밀가루 ${flour} · 수면 ${r.sleep}h${r.memo?' · '+r.memo.slice(0,18):''}</span><b>${r.score}점</b>
      <span class="history-actions"><button class="mini-btn edit">보기·수정</button><button class="mini-btn delete">삭제</button></span>`;
    d.querySelector('.edit').onclick=()=>{loadRecordDate(r.date);showTab('record')};
    d.querySelector('.delete').onclick=()=>{
      if(!confirm(`${r.date} 기록을 삭제할까요?`))return;
      delete state.records[r.date];if(state.checks[r.date])delete state.checks[r.date];
      save();renderAll();toast('기록을 삭제했습니다.');
    };
    list.appendChild(d)
  });
  if(!list.children.length)list.innerHTML='<p class="sub">저장된 기록이 없습니다.</p>';
}
function renderRecordForm(){loadRecordDate(selectedRecordDate||today())}

const quotePools={
 encourage:[
  '오늘도 한 걸음이면 충분합니다.','완벽함보다 꾸준함이 더 강합니다.','오늘 기록을 남긴 것만으로도 충분히 잘했습니다.','쉬어가는 날도 성장의 일부입니다.','작은 습관 하나가 큰 변화를 만듭니다.','어제보다 오늘 한 번 더 돌본 것이 가장 큰 변화입니다.','피부는 조급함보다 시간을 좋아합니다.','한 번의 흔들림은 지금까지의 노력을 지우지 못합니다.','좋아지는 속도보다 포기하지 않는 방향이 중요합니다.','오늘도 충분히 잘하고 있습니다.'
 ],
 affirm:[
  '나는 반드시 피부가 깨끗해진다.','나는 26살로 보이는 동안 페이스다.','나는 얼굴이 더 탄력있고 탱탱해졌다.','나는 예쁘다, 아름답다는 소리를 정말 많이 듣는다.','정말 피부 좋다, 부럽다는 소리를 많이 듣는다.','내 짝꿍이 내 피부가 모찌모찌하다며 정말 좋아한다.','내 피부에 내가 감탄을 한다.','가만히 있어도 나는 예쁘게 웃는 미소녀이다.','교정이 정말 내 얼굴에 맞게 조화롭게 잘 되어서 더욱 예뻐지고 고급스러운 분위기를 뽐내는 미녀가 되었다.','여드름이 더 이상 나지 않고, 매끈한 피부에 광나는 피부가 되어 쌩얼로도 충분히 예쁘고 당당하게 다니게 되었다.','나는 오늘도 피부를 아끼는 선택을 한다.','내 피부는 매일 더 맑고 편안해지고 있다.'
 ],
 future:[
  '미래의 나는 오늘의 나에게 고마워할 것입니다.','오늘의 기록은 1년 뒤 가장 소중한 선물이 됩니다.','나는 매일 목표 피부에 가까워지고 있습니다.','오늘의 작은 선택이 미래의 자신감을 만듭니다.','지금의 꾸준함은 언젠가 눈에 보이는 변화가 됩니다.','오늘 남긴 한 줄이 1년 뒤 나의 성장 이야기가 됩니다.','미래의 나는 지금보다 더 편안하게 거울을 바라봅니다.','오늘의 습관이 내일의 피부를 천천히 바꿉니다.'
 ]
};
const anniversaryQuotes={1:'🌱 오늘부터 Skin Reset 여정이 시작됩니다.',7:'🌿 첫 일주일입니다. 잘하고 있어요.',30:'🌸 벌써 한 달입니다. 지금의 꾸준함이 가장 큰 변화입니다.',100:'💛 100일 동안 이어온 습관은 쉽게 사라지지 않습니다.',180:'🌳 반이나 왔습니다. 정말 대단합니다.',365:'👑 오늘은 피부가 아니라 당신의 꾸준함을 축하하는 날입니다.'};
const weekdayMeta=[
 {type:'random',label:'🌈 일요일 · 랜덤',cls:'weekday-sun'},
 {type:'encourage',label:'🌱 월요일 · 응원형',cls:'weekday-mon'},
 {type:'affirm',label:'✨ 화요일 · 확언형',cls:'weekday-tue'},
 {type:'future',label:'🌸 수요일 · 미래형',cls:'weekday-wed'},
 {type:'encourage',label:'🌿 목요일 · 응원형',cls:'weekday-thu'},
 {type:'affirm',label:'☀️ 금요일 · 확언형',cls:'weekday-fri'},
 {type:'future',label:'🌙 토요일 · 미래형',cls:'weekday-sat'}
];
function allQuotes(){
 const built=[];Object.entries(quotePools).forEach(([type,arr])=>arr.forEach((text,i)=>built.push({id:`base-${type}-${i}`,type,text,source:'기본'})));
 return built.concat((state.customQuotes||[]).map(q=>({...q,source:'내 문구'})));
}
function projectDay(){return Math.max(1,diffDays(state.startDate,today())+1)}
function todayQuote(){
 const day=projectDay();
 if(anniversaryQuotes[day])return {id:`anniversary-${day}`,type:'anniversary',text:anniversaryQuotes[day],label:'🎂 기념일 문구',cls:'weekday-fri'};
 const meta=weekdayMeta[new Date().getDay()];let type=meta.type;
 if(type==='random')type=['encourage','affirm','future'][hashDate(today()+'type')%3];
 let pool=allQuotes().filter(q=>q.type===type);
 if(!pool.length)pool=allQuotes();
 const quote=pool[hashDate(today()+'quote')%pool.length];return {...quote,label:meta.label,cls:meta.cls};
}

const missionPool=[
{id:'water',title:'물 한 컵 더 마시기',xp:5,kind:'water',icon:'💧'},
{id:'record',title:'오늘 피부 기록 남기기',xp:8,kind:'record',icon:'✎'},
{id:'photo',title:'피부 사진 한 장 남기기',xp:8,kind:'photo',icon:'📷'},
{id:'flour',title:'다음 식사는 밀가루 없이 먹기',xp:12,kind:'flour',icon:'🌾'},
{id:'salad',title:'오늘 샐러드나 생채소 한 번 먹기',xp:10,kind:'food',icon:'🥗'},
{id:'fruit',title:'과일 한 번 챙겨 먹기',xp:7,kind:'food',icon:'🍎'},
{id:'nuts',title:'견과류 한 줌 챙기기',xp:7,kind:'food',icon:'🥜'},
{id:'green',title:'녹색 채소 한 가지 먹기',xp:8,kind:'food',icon:'🥬'},
{id:'sweetDrink',title:'단 음료 대신 물 선택하기',xp:8,kind:'water',icon:'🥤'},
{id:'rest',title:'3분 동안 눈 감고 쉬기',xp:5,kind:'rest',icon:'😌'},
{id:'touch',title:'지금부터 얼굴 만지지 않기',xp:6,kind:'skin',icon:'🙌'},
{id:'moist',title:'평소 쓰던 보습제 꼼꼼히 바르기',xp:6,kind:'skin',icon:'🧴'},
{id:'sunscreen',title:'외출 전 선크림 챙기기',xp:7,kind:'skin',icon:'☀️'},
{id:'pillow',title:'베개 커버 상태 확인하기',xp:8,kind:'skin',icon:'🛏️'},
{id:'sleep',title:'오늘 30분 일찍 잘 준비하기',xp:10,kind:'sleep',icon:'😴'},
{id:'phone',title:'자기 전 휴대폰 30분 쉬기',xp:10,kind:'sleep',icon:'📵'},
{id:'diary',title:'피부 일기 한 줄 남기기',xp:7,kind:'diary',icon:'📖'},
{id:'walk',title:'10분만 가볍게 걷기',xp:8,kind:'rest',icon:'🚶‍♀️'},
{id:'stretch',title:'스트레칭 10분 하기',xp:8,kind:'rest',icon:'🧘‍♀️'}
];
function hashDate(x){let h=0;for(const c of x)h=(h*31+c.charCodeAt(0))>>>0;return h}
function missionStreakCount(){let n=0,d=today();while(state.missions?.[d]?.done){n++;d=addDays(d,-1)}return n}
function chooseMission(){if(state.missions[today()])return state.missions[today()];const r=state.records[today()],recent=(state.missionHistory||[]).slice(-5).map(x=>x.id);let kinds=[];if(!r)kinds.push('record');if(r&&r.water<1.5)kinds.push('water');if(r&&r.sleep<7)kinds.push('sleep');if(r&&r.flour>0)kinds.push('flour');if(!state.actualPhotos.some(p=>p.date===today()))kinds.push('photo');if(r&&!r.diaryLine)kinds.push('diary');kinds.push('skin','rest','food');let c=missionPool.filter(m=>kinds.includes(m.kind)&&!recent.includes(m.id));if(!c.length)c=missionPool.filter(m=>!recent.includes(m.id));if(!c.length)c=missionPool;const lucky=hashDate(today()+'lucky')%100<18,p=c[hashDate(today()+Object.keys(state.records).length)%c.length],m={...p,date:today(),lucky,xp:lucky?p.xp*2:p.xp,done:false};state.missions[today()]=m;save();return m}
function coachForToday(){
  const r=state.records[today()];
  const recent=lastNDays(7);
  const prev=state.records[addDays(today(),-1)];
  const details=[];

  if(!r){
    return {
      main:'오늘 기록을 남기면 수면·물·밀가루·피부 상태를 함께 살펴 맞춤 코칭이 시작됩니다.',
      evidence:'아직 오늘 기록이 없습니다.',
      details:[
        ['기록 후 자동 분석','오늘 잘한 점과 내일 우선할 한 가지'],
        ['최근 흐름','기록이 쌓이면 7일 변화도 함께 표시']
      ]
    };
  }

  const mainParts=[];
  if(prev){
    const diff=r.score-prev.score;
    if(diff>=4)mainParts.push(`어제보다 피부 점수가 ${diff}점 올랐습니다.`);
    else if(diff<=-4)mainParts.push(`어제보다 피부 점수가 ${Math.abs(diff)}점 낮아졌습니다.`);
    else mainParts.push('어제와 비슷한 피부 흐름을 유지하고 있습니다.');
  }else{
    mainParts.push(`오늘 피부 점수는 ${r.score}점입니다.`);
  }

  let best='오늘 기록을 완료했습니다.';
  const candidates=[
    {ok:r.water>=1.5,text:`물 ${r.water}L를 기록해 수분 목표를 달성했습니다.`},
    {ok:r.sleep>=7,text:`수면 ${r.sleep}시간을 확보했습니다.`},
    {ok:r.flour===0,text:'밀가루 없이 하루를 보냈습니다.'},
    {ok:!!r.diaryLine,text:'피부 상태와 마음을 한 줄로 남겼습니다.'}
  ].filter(x=>x.ok);
  if(candidates.length)best=candidates[0].text;

  let focus='오늘의 흐름을 그대로 이어가 보세요.';
  if(r.sleep<6)focus='오늘은 평소보다 30분 일찍 잘 준비해 보세요.';
  else if(r.water<1.2)focus='잠들기 전까지 물 한 컵을 천천히 더 마셔보세요.';
  else if(r.flour>0)focus='다음 식사 한 끼만 밀가루 없이 선택해 보세요.';
  else if(r.redness>=3||r.dryness>=3||r.itch>=3)focus='새로운 제품보다 익숙한 저자극 보습과 휴식을 우선해 보세요.';
  else if(r.troubleLevel>=3)focus='피부를 만지거나 짜지 않고 편안하게 쉬게 해주세요.';

  const ci=cycleInfo();
  if(ci){
    const until=diffDays(today(),ci.next);
    if(ci.stage==='생리 기간')mainParts.push('현재 생리 기간 기록과 함께 피부 변화를 관찰하고 있습니다.');
    else if(ci.stage==='배란기')mainParts.push('현재 배란 예상 시기이므로 평소와 다른 유분·트러블 변화를 기록해 보세요.');
    else if(ci.stage==='황체기'&&until>=0&&until<=7)mainParts.push('다음 생리 전 일주일에 해당해 피부가 예민해지는지 살펴볼 시기입니다.');
  }

  details.push(['오늘 가장 잘한 점',best],['내일 우선할 한 가지',focus]);

  if(recent.length>=3){
    const scores=recent.map(x=>x.score);
    const trend=scores[scores.length-1]-scores[0];
    const avgSleep=avg(recent.map(x=>Number(x.sleep||0)));
    const flourDays=recent.filter(x=>x.flour>0).length;
    const waterDays=recent.filter(x=>x.water>=1.5).length;
    details.push(['최근 7일 흐름',trend>2?`${trend}점 상승`:trend<-2?`${Math.abs(trend)}점 하락`:'큰 변화 없이 유지']);
    details.push(['생활 기록',`평균 수면 ${avgSleep}시간 · 무밀가루 ${recent.length-flourDays}/${recent.length}일 · 물 목표 ${waterDays}/${recent.length}일`]);
  }else{
    details.push(['분석 단계',`${recent.length}일 기록됨 · 3일 이상부터 흐름 비교`]);
  }

  return {
    main:mainParts.join(' '),
    evidence:`오늘 피부 점수 ${r.score}점 · 개인 기록 기반 참고 분석`,
    details
  };
}

function praiseForToday(){
  const r=state.records[today()];
  const details=[];

  if(!r){
    return {
      main:'앱을 열고 다시 시작한 것부터 이미 좋은 변화입니다.',
      details:[['오늘의 칭찬','완벽하게 하지 않아도 다시 돌아온 선택이 중요합니다.']]
    };
  }

  const all=Object.values(state.records);
  const mx=Math.max(...all.map(x=>x.score));
  let main='오늘 기록을 남긴 꾸준함이 정말 좋습니다.';

  if(r.score===mx&&all.length>1)main='지금까지의 최고 피부 점수를 기록했습니다.';
  else if(missionStreakCount()>=7)main=`작은 미션을 ${missionStreakCount()}일 연속 완료하고 있습니다.`;
  else if(streak()>=7)main=`밀가루 없이 ${streak()}일을 이어가고 있습니다.`;
  else if(r.water>=1.5)main='오늘도 수분 목표를 달성했습니다.';
  else if(r.sleep>=7)main='피부가 회복할 수 있는 수면 시간을 잘 챙겼습니다.';
  else if(r.diaryLine)main='피부 상태뿐 아니라 오늘의 마음까지 기록했습니다.';

  if(r.flour===0)details.push(['좋은 선택','오늘 밀가루 없이 보냈어요.']);
  if(r.water>=1.5)details.push(['수분','오늘 물 목표를 달성했어요.']);
  if(r.sleep>=7)details.push(['휴식',`수면 ${r.sleep}시간을 기록했어요.`]);
  if(state.actualPhotos.some(p=>p.date===today()))details.push(['사진 기록','오늘 피부 사진도 남겼어요.']);
  if(r.diaryLine)details.push(['피부 일기','오늘의 한 줄을 남겼어요.']);
  if(!details.length)details.push(['가장 중요한 성과','오늘 기록을 빠뜨리지 않고 남겼어요.']);

  return {main,details:details.slice(0,3)};
}

function treeInfo(){const x=Number(state.xp||0);if(x<50)return ['🌱','첫 습관을 키우는 새싹'];if(x<150)return ['🌿','꾸준함이 잎으로 자라고 있어요'];if(x<350)return ['🌳','기록이 단단한 나무가 되었어요'];if(x<700)return ['🌳🌸','작은 꽃이 피기 시작했어요'];if(x<1200)return ['🌸🌳🌸','좋은 습관이 활짝 피고 있어요'];return ['🌸🌳🦋🌸','1년의 습관이 만든 만개한 나무']}
function renderJourney(days){
 const milestones=[{m:1,d:30,icon:'🌱'},{m:3,d:90,icon:'🌿'},{m:6,d:180,icon:'🌳'},{m:9,d:270,icon:'🌸'},{m:12,d:365,icon:'👑'}];
 const track=document.getElementById('journeyTrack');track.querySelectorAll('.journey-node').forEach(x=>x.remove());
 milestones.forEach((x,i)=>{const node=document.createElement('div');const done=days>=x.d;const nextIndex=milestones.findIndex(v=>days<v.d);const current=i===(nextIndex<0?milestones.length-1:nextIndex);node.className='journey-node'+(done?' done':'')+(current&&!done?' current':'');node.innerHTML=`<div class="journey-icon">${done?'✓':x.icon}</div><b>${x.m}개월</b><span>${done?'완료':current?'진행 중':'예정'}</span>`;track.appendChild(node)});
 document.getElementById('journeyProgress').style.width=Math.min(82,days/365*82)+'%';
 let current=milestones.find(x=>days<=x.d)||milestones[milestones.length-1];let prev=milestones[milestones.indexOf(current)-1]?.d||0;let elapsed=Math.max(0,days-prev),span=current.d-prev,pc=Math.min(100,Math.round(elapsed/span*100));
 document.getElementById('currentProjectTitle').textContent=`${current.icon} ${current.m}개월 프로젝트`;
 document.getElementById('currentProjectDays').textContent=`${days} / ${current.d}일`;
 document.getElementById('currentProjectPercent').textContent=`${pc}%`;
 document.getElementById('currentProjectBar').style.width=pc+'%';
 document.getElementById('currentProjectRemain').textContent=days>=365?'365일 여정 완료':`${Math.max(0,current.d-days)}일 남음`;
 const idx=milestones.indexOf(current);document.getElementById('nextProjectLabel').textContent=idx<4?`다음 목표: ${milestones[idx+1].m}개월`:'마지막 목표';
 document.getElementById('journeyBadge').textContent=days>=365?'완료 👑':`${days}일째`;
}
function renderCoachMission(){
 const coach=coachForToday(),praise=praiseForToday();
 dailyCoach.textContent=coach.main;
 coachEvidence.textContent=coach.evidence;
 dailyPraise.textContent=praise.main;
 const coachDetailsEl=document.getElementById('coachDetails');
 if(coachDetailsEl)coachDetailsEl.innerHTML=(coach.details||[]).map(x=>`<div class="coach-detail-row"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
 const praiseDetailsEl=document.getElementById('praiseDetails');
 if(praiseDetailsEl)praiseDetailsEl.innerHTML=(praise.details||[]).map(x=>`<div class="coach-detail-row"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
 const q=todayQuote(),card=document.getElementById('quoteCard');card.className='card quote-card '+q.cls;dailyMotivation.textContent=q.text;quoteType.textContent=q.label;quoteDayLabel.textContent=`Skin Reset ${projectDay()}일째`;
 const fav=(state.favoriteQuotes||[]).includes(q.id);favoriteQuote.textContent=fav?'♥':'♡';favoriteQuote.classList.toggle('active',fav);favoriteQuote.dataset.quoteId=q.id;
 if(!state.quoteHistory[today()]){state.quoteHistory[today()]={id:q.id,type:q.type,text:q.text,label:q.label};save()}
 const m=chooseMission();missionCard.classList.toggle('lucky',m.lucky);missionTag.textContent=m.lucky?'🎁 Lucky Mission!':'🌱 오늘의 작은 미션';missionTitle.textContent=`${m.icon||'🌱'} ${m.title}`;missionXP.textContent=`+${m.xp} XP`;missionReason.textContent=m.lucky?'오늘은 특별 보상 2배 미션이 등장했어요.':'최근 기록과 최근에 나오지 않은 미션을 함께 고려했어요.';completeMission.style.display=m.done?'none':'block';missionDone.style.display=m.done?'block':'none';
 const xp=Number(state.xp||0),lv=Math.floor(xp/100)+1,w=xp%100,t=treeInfo();levelText.textContent=`Level ${lv}`;xpText.textContent=`${xp} XP`;nextLevelText.textContent=`다음 레벨까지 ${100-w} XP`;xpBar.style.width=w+'%';skinTree.textContent=t[0];treeCaption.textContent=t[1];
 const days=projectDay();welcomeDay.textContent=`${days}일째`;const greet=['오늘도 미래의 피부를 위한 작은 선택 하나.','오늘의 기록이 내일의 자신감을 만듭니다.','완벽함보다 꾸준함이 더 강합니다.','피부는 조급함보다 시간을 좋아합니다.','오늘도 나를 다정하게 돌보는 하루.'];welcomeMessage.textContent=greet[hashDate(today()+'greet')%greet.length];renderJourney(days);
}
completeMission.onclick=completeTodayMission;
function renderDiary(target,records,limit=999){target.innerHTML='';const q=(diarySearch?.value||'').trim().toLowerCase();records.filter(r=>(r.diaryLine||r.selfMessage)&&(!q||`${r.diaryLine} ${r.selfMessage} ${r.memo}`.toLowerCase().includes(q))).slice(0,limit).forEach(r=>{const d=document.createElement('div');d.className='diary-entry';d.innerHTML=`<small>${r.date} · ${r.mood||'🙂'} · 피부 ${r.score}점</small>${r.diaryLine?`<p>${r.diaryLine}</p>`:''}${r.selfMessage?`<p class="sub">오늘 나에게: ${r.selfMessage}</p>`:''}`;target.appendChild(d)});if(!target.children.length)target.innerHTML='<p class="sub">아직 작성한 피부 일기가 없습니다.</p>'}
if(document.getElementById('diarySearch'))diarySearch.oninput=()=>renderDiary(diaryList,Object.values(state.records).sort((a,b)=>b.date.localeCompare(a.date)));
function answerCoach(q){const r=lastNDays(30);if(!r.length)return '분석할 기록이 아직 없습니다.';const av=a=>avg(a.map(x=>x.score));if(q==='best'){const b=r.slice().sort((a,b)=>b.score-a.score)[0];return `${b.date}에 ${b.score}점으로 가장 높았습니다. 당시 수면 ${b.sleep}시간, 물 ${b.water}L였습니다.`}if(q==='flour'){const n=r.filter(x=>x.flour===0),y=r.filter(x=>x.flour>0);return n.length&&y.length?`무밀가루 날 평균 ${av(n)}점, 섭취한 날 평균 ${av(y)}점입니다. 기록상 상관관계 참고치이며 원인 확정은 아닙니다.`:'두 조건의 기록이 모두 필요합니다.'}if(q==='priority'){const a=[['수면',r.filter(x=>x.sleep>=7),r.filter(x=>x.sleep<7)],['물',r.filter(x=>x.water>=1.5),r.filter(x=>x.water<1.5)],['밀가루',r.filter(x=>x.flour===0),r.filter(x=>x.flour>0)]].filter(x=>x[1].length&&x[2].length).map(x=>({n:x[0],d:av(x[1])-av(x[2])})).sort((a,b)=>b.d-a.d);return a.length?`현재 기록에서는 ${a[0].n} 조건의 평균 차이가 ${a[0].d}점으로 가장 큽니다. 작은 실험으로 다시 확인해보세요.`:'비교 가능한 기록이 더 필요합니다.'}if(q==='praise')return `최근 30일 중 ${r.length}일을 기록했습니다. 무엇보다 기록을 이어온 점이 가장 잘한 부분입니다.`;const r7=lastNDays(7),low=r7.filter(x=>x.sleep<7).length,fl=r7.filter(x=>x.flour>0).length;return `최근 7일에는 수면 7시간 미만 ${low}회, 밀가루 섭취 ${fl}회가 기록되었습니다. 단일 원인으로 단정할 수 없지만 먼저 살펴볼 변수입니다.`}
askCoach.onclick=()=>coachAnswer.textContent=answerCoach(coachQuestion.value);
function renderGrowth(){futureLetterDisplay.textContent=state.futureLetter||'목표 탭에서 미래의 나에게 편지를 적어보세요.';const days=Math.max(1,diffDays(state.startDate,today())+1);letterMilestone.textContent=`프로젝트 ${days}일째입니다.`;const h=state.missionHistory||[];missionTotal.textContent=h.length;missionStreak.textContent=missionStreakCount();luckyTotal.textContent=h.filter(x=>x.lucky).length;missionHistory.innerHTML='';h.slice(-6).reverse().forEach(m=>{const d=document.createElement('div');d.className='checkline';d.innerHTML=`<span>${m.lucky?'🎁':'🌱'} ${m.title}</span><b>+${m.xp} XP</b>`;missionHistory.appendChild(d)});if(!missionHistory.children.length)missionHistory.innerHTML='<p class="sub">완료한 미션이 없습니다.</p>'}
favoriteQuote.onclick=()=>{const q=todayQuote(),arr=state.favoriteQuotes||[];const i=arr.indexOf(q.id);if(i>=0){arr.splice(i,1);toast('즐겨찾기에서 삭제했습니다.')}else{arr.push(q.id);toast('즐겨찾기에 저장했습니다.')}state.favoriteQuotes=arr;save();renderCoachMission();};
let activeQuoteFilter='all';
function quoteTypeName(type){return {encourage:'응원형',affirm:'확언형',future:'미래형',anniversary:'기념일'}[type]||type}
function renderQuoteLibrary(){
 const q=(document.getElementById('quoteSearch')?.value||'').trim().toLowerCase();const fav=state.favoriteQuotes||[];let list=allQuotes();
 if(activeQuoteFilter==='custom')list=list.filter(x=>x.source==='내 문구');else if(activeQuoteFilter==='favorite')list=list.filter(x=>fav.includes(x.id));else if(activeQuoteFilter!=='all')list=list.filter(x=>x.type===activeQuoteFilter);
 if(q)list=list.filter(x=>x.text.toLowerCase().includes(q));quoteLibraryList.innerHTML='';
 list.forEach(item=>{const d=document.createElement('div');d.className='quote-item';d.innerHTML=`<div><p>${item.text}</p><small>${quoteTypeName(item.type)} · ${item.source}</small></div><div class="actions"><button class="icon-btn fav">${fav.includes(item.id)?'♥':'♡'}</button>${item.source==='내 문구'?'<button class="mini-btn delete">삭제</button>':''}</div>`;d.querySelector('.fav').onclick=()=>{const i=state.favoriteQuotes.indexOf(item.id);if(i>=0)state.favoriteQuotes.splice(i,1);else state.favoriteQuotes.push(item.id);save();renderQuoteLibrary();renderCoachMission()};const del=d.querySelector('.delete');if(del)del.onclick=()=>{state.customQuotes=state.customQuotes.filter(x=>x.id!==item.id);state.favoriteQuotes=state.favoriteQuotes.filter(x=>x!==item.id);save();renderQuoteLibrary()};quoteLibraryList.appendChild(d)});
 if(!quoteLibraryList.children.length)quoteLibraryList.innerHTML='<p class="sub">해당 문구가 없습니다.</p>';
 quoteHistoryList.innerHTML='';Object.entries(state.quoteHistory||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30).forEach(([date,item])=>{const d=document.createElement('div');d.className='quote-item';d.innerHTML=`<div><p>${item.text}</p><small>${date} · ${item.label||quoteTypeName(item.type)}</small></div>`;quoteHistoryList.appendChild(d)});if(!quoteHistoryList.children.length)quoteHistoryList.innerHTML='<p class="sub">아직 문구 기록이 없습니다.</p>';
}
addCustomQuote.onclick=()=>{const text=customQuoteInput.value.trim();if(!text)return toast('문구를 입력해 주세요.');state.customQuotes.push({id:'custom-'+Date.now(),type:customQuoteType.value,text});customQuoteInput.value='';save();renderQuoteLibrary();toast('나만의 문구를 추가했습니다.')};
quoteSearch.oninput=renderQuoteLibrary;document.querySelectorAll('#quoteFilters .tab-chip').forEach(b=>b.onclick=()=>{activeQuoteFilter=b.dataset.filter;document.querySelectorAll('#quoteFilters .tab-chip').forEach(x=>x.classList.toggle('active',x===b));renderQuoteLibrary()});

function renderSettings(){const r=state.reminder||defaultState().reminder;reminderEnabled.checked=!!r.enabled;reminderTime.value=r.time||'21:30';reminderWeekend.checked=r.weekend!==false;reminderSkipDone.checked=r.skipDone!==false;notificationPermission.textContent=('Notification'in window)?({granted:'허용됨',denied:'차단됨',default:'아직 요청하지 않음'}[Notification.permission]):'지원하지 않음'}
saveReminder.onclick=()=>{state.reminder={...state.reminder,enabled:reminderEnabled.checked,time:reminderTime.value||'21:30',weekend:reminderWeekend.checked,skipDone:reminderSkipDone.checked};save();renderSettings();toast('알림 설정을 저장했습니다.')};requestNotification.onclick=async()=>{if(!('Notification'in window))return toast('이 브라우저는 알림을 지원하지 않습니다.');await Notification.requestPermission();renderSettings()};testNotification.onclick=()=>{if(Notification.permission==='granted')new Notification('Skin Reset 365',{body:'목표 피부를 향한 오늘의 기록을 남겨주세요.'});else toast('먼저 알림 권한을 허용해 주세요.')};
setInterval(()=>{const r=state.reminder;if(!r?.enabled)return;const n=new Date(),cur=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;if(cur!==r.time||r.lastNotified===today()||(r.skipDone&&state.records[today()])||(!r.weekend&&(n.getDay()===0||n.getDay()===6)))return;if(Notification.permission==='granted'){new Notification('Skin Reset 365',{body:'목표 피부를 향한 오늘의 기록을 남겨주세요.'});r.lastNotified=today();save()}},30000);


let cycleCursor=new Date();
function cycleInfo(date=today()){
  const c=state.cycle||{};if(!c.startDate)return null;
  const len=Number(c.cycleLength||28),periodLen=Number(c.periodLength||5);
  let start=c.startDate;
  while(addDays(start,len)<=date)start=addDays(start,len);
  while(start>date)start=addDays(start,-len);
  const day=diffDays(start,date)+1,next=addDays(start,len),ovulation=addDays(next,-14),periodEnd=addDays(start,periodLen-1);
  let stage='황체기';if(day<=periodLen)stage='생리 기간';else if(date<ovulation)stage='난포기';else if(Math.abs(diffDays(date,ovulation))<=1)stage='배란기';
  return {start,day,next,ovulation,periodEnd,len,periodLen,stage};
}
function renderCycle(){
  const c=state.cycle||defaultState().cycle;
  document.getElementById('cycleStartDate').value=c.startDate||'';document.getElementById('cycleEndDate').value=c.endDate||'';
  document.getElementById('cycleLengthInput').value=c.cycleLength||28;document.getElementById('periodLengthInput').value=c.periodLength||5;
  const info=cycleInfo();
  if(!info){document.getElementById('cycleHeadline').textContent='생리 주기';document.getElementById('cycleSubline').textContent='최근 생리 시작일을 입력하면 다음 생리와 배란 예상이 시작됩니다.';document.getElementById('cycleDayValue').textContent='--';document.getElementById('nextPeriodValue').textContent='--';document.getElementById('ovulationValue').textContent='--';document.getElementById('cycleStageDot').style.left='0%';}
  else{
    document.getElementById('cycleHeadline').textContent=`오늘은 ${info.stage}입니다`;
    document.getElementById('cycleSubline').textContent=`현재 주기 ${info.day}일째 · 다음 생리 예상 ${new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric'}).format(new Date(info.next+'T00:00:00'))}`;
    document.getElementById('cycleDayValue').textContent=info.day+'일째';document.getElementById('nextPeriodValue').textContent=Math.max(0,diffDays(today(),info.next))+'일 후';document.getElementById('ovulationValue').textContent=new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric'}).format(new Date(info.ovulation+'T00:00:00'));
    document.getElementById('cycleStageDot').style.left=Math.min(100,Math.max(0,(info.day-1)/(info.len-1)*100))+'%';
  }
  renderCycleCalendar();renderCycleForecast(info);
}
function renderCycleForecast(info){
  const box=document.getElementById('cycleSkinForecast'),care=document.getElementById('cycleCareList');care.innerHTML='';
  if(!info){box.textContent='주기를 설정하면 시기별 안내가 표시됩니다.';['최근 생리 시작일 입력하기','평균 주기와 생리 기간 저장하기','매일 피부 상태 기록하기'].forEach(x=>{const d=document.createElement('div');d.textContent='□ '+x;care.appendChild(d)});return;}
  let text='',items=[];
  if(info.stage==='생리 기간'){text='최근 기록에서 이 기간의 피부 점수와 붉은기 변화를 비교할 수 있습니다. 피부가 예민하다면 새로운 제품보다 익숙한 저자극 관리를 우선하세요.';items=['강한 각질 제거와 스크럽 미루기','평소 쓰던 순한 보습제 사용하기','수면과 물 섭취 기록 남기기'];}
  else if(info.stage==='배란기'){text='배란 전후에는 일부 사용자에게 유분과 트러블 변화가 기록될 수 있습니다. 실제 변화는 개인 기록을 우선해 확인하세요.';items=['번들거림과 트러블 정도 기록하기','얼굴을 반복해서 만지지 않기','베개 커버와 세안 습관 점검하기'];}
  else if(info.stage==='황체기'){text='다음 생리 전에는 트러블·붉은기·번들거림이 반복되는지 살펴보는 시기입니다. 최소 3주기 이상 기록하면 개인 패턴 확인에 도움이 됩니다.';items=['새 화장품 시작은 신중하게 하기','충분한 수면 시간 확보하기','트러블을 손으로 짜지 않기'];}
  else{text='생리 직후부터 배란 전까지의 피부 회복 흐름을 관찰해 보세요. 평소 관리가 잘 맞는지 비교하기 좋은 시기입니다.';items=['피부 사진을 같은 조건으로 남기기','보습과 자외선 차단 유지하기','피부 점수와 생활 습관 함께 기록하기'];}
  box.textContent=text;items.forEach(x=>{const d=document.createElement('div');d.textContent='□ '+x;care.appendChild(d)});
}
function renderCycleCalendar(){
  const y=cycleCursor.getFullYear(),m=cycleCursor.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  document.getElementById('cycleMonthTitle').textContent=`${y}년 ${m+1}월`;
  const w=document.getElementById('cycleWeekdays');w.innerHTML='';
  ['일','월','화','수','목','금','토'].forEach(x=>{const e=document.createElement('div');e.className='cycle-weekday';e.textContent=x;w.appendChild(e)});

  const c=state.cycle||{};
  const anchor=c.startDate||'';
  const cycleLen=Number(c.cycleLength||28);
  const periodLen=Number(c.periodLength||5);

  function phaseForDate(date){
    if(!anchor)return null;
    let cycleStart=anchor;
    while(addDays(cycleStart,cycleLen)<=date)cycleStart=addDays(cycleStart,cycleLen);
    while(cycleStart>date)cycleStart=addDays(cycleStart,-cycleLen);
    const dayIndex=diffDays(cycleStart,date);
    const nextStart=addDays(cycleStart,cycleLen);
    const ovulation=addDays(nextStart,-14);
    return {
      isPeriod:dayIndex>=0&&dayIndex<periodLen,
      isOvulation:Math.abs(diffDays(date,ovulation))<=1
    };
  }

  const box=document.getElementById('cycleCalendar');box.innerHTML='';
  for(let i=0;i<first;i++){const e=document.createElement('div');e.className='cycle-day empty';box.appendChild(e)}
  for(let d=1;d<=days;d++){
    const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const phase=phaseForDate(date);
    const el=document.createElement('div');
    el.className='cycle-day'+(date===today()?' today':'');
    let marker='';
    if(phase?.isPeriod){el.classList.add('period');marker='🌸'}
    else if(phase?.isOvulation){el.classList.add('ovulation');marker='◌'}
    el.innerHTML=`<b>${d}</b>${marker?`<span class="marker">${marker}</span>`:''}`;
    box.appendChild(el);
  }
}
document.getElementById('saveCycleSettings').onclick=()=>{state.cycle={startDate:document.getElementById('cycleStartDate').value,endDate:document.getElementById('cycleEndDate').value,cycleLength:Number(document.getElementById('cycleLengthInput').value||28),periodLength:Number(document.getElementById('periodLengthInput').value||5)};save();renderCycle();toast('생리 주기 설정을 저장했습니다.')};
document.getElementById('cyclePrevMonth').onclick=()=>{cycleCursor=new Date(cycleCursor.getFullYear(),cycleCursor.getMonth()-1,1);renderCycleCalendar()};
document.getElementById('cycleNextMonth').onclick=()=>{cycleCursor=new Date(cycleCursor.getFullYear(),cycleCursor.getMonth()+1,1);renderCycleCalendar()};

function backupPayload(){
  return {
    format:'skin-reset-365',
    version:1,
    exportedAt:new Date().toISOString(),
    state
  };
}
function downloadTextFile(filename,text,type='application/json'){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1200);
}

async function readBackupFile(file){
  if(!file)throw new Error('선택된 파일이 없습니다.');

  let text='';
  if(typeof file.text==='function'){
    text=await file.text();
  }else{
    text=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('파일을 읽지 못했습니다.'));
      reader.readAsText(file,'utf-8');
    });
  }

  text=String(text||'').replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('빈 파일입니다.');

  let raw;
  try{
    raw=JSON.parse(text);
  }catch{
    throw new Error('백업 파일의 내용을 읽을 수 없습니다.');
  }

  const isWrapped=raw&&raw.format==='skin-reset-365'&&raw.state&&typeof raw.state==='object';
  const isLegacy=raw&&typeof raw==='object'&&(
    raw.records||raw.goalPhotos||raw.actualPhotos||raw.startDate||raw.cycle
  );

  if(!isWrapped&&!isLegacy){
    throw new Error('Skin Reset 365 백업 파일이 아닙니다.');
  }
  return raw;
}

async function importBackupFromInput(input){
  const file=input?.files?.[0];
  if(!file)return;

  try{
    const raw=await readBackupFile(file);
    const fileLabel=file.name||'선택한 백업 파일';
    if(!confirm(`${fileLabel}의 데이터로 현재 앱을 복원할까요?\n현재 데이터는 교체됩니다.`))return;
    restoreState(raw);
    toast('백업을 복원했습니다.');
  }catch(err){
    console.error('[Skin Reset] 백업 가져오기 오류',err);
    alert(`백업을 가져오지 못했습니다.\n${err?.message||'파일을 다시 확인해 주세요.'}`);
  }finally{
    input.value='';
  }
}

function restoreState(raw){
  const source=raw?.state&&raw.format==='skin-reset-365'?raw.state:raw;
  state={
    ...defaultState(),
    ...source,
    reminder:{...defaultState().reminder,...(source.reminder||{})},
    cycle:{...defaultState().cycle,...(source.cycle||{})},
    missions:{...(source.missions||{})},
    missionHistory:[...(source.missionHistory||[])],
    customQuotes:[...(source.customQuotes||[])],
    favoriteQuotes:[...(source.favoriteQuotes||[])],
    quoteHistory:{...(source.quoteHistory||{})},
    timeCapsules:{...(source.timeCapsules||{})}
  };
  save();renderAll();
}
function monthKey(date=today()){return date.slice(0,7)}
function recordsForMonth(key){
  return Object.values(state.records).filter(r=>r.date?.startsWith(key)).sort((a,b)=>a.date.localeCompare(b.date));
}
function avgSafe(arr){return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10:null}
function renderBackupCenter(){
  const rc=document.getElementById('backupRecordCount');
  if(!rc)return;
  rc.textContent=Object.keys(state.records).length+'개';
  document.getElementById('backupPhotoCount').textContent=((state.goalPhotos?.length||0)+(state.actualPhotos?.length||0))+'장';
  document.getElementById('lastBackupText').textContent=state.lastBackupAt?formatModified(state.lastBackupAt):'없음';
  const monthInput=document.getElementById('reportMonth');
  if(monthInput&&!monthInput.value)monthInput.value=monthKey();
  renderReportPreview();
  renderCapsules();
}
function renderReportPreview(){
  const el=document.getElementById('reportPreview');
  const input=document.getElementById('reportMonth');
  if(!el||!input)return;
  const rec=recordsForMonth(input.value||monthKey());
  if(!rec.length){el.textContent='선택한 달에 기록이 없습니다.';return}
  const avgScore=avgSafe(rec.map(r=>r.score));
  const avgSleep=avgSafe(rec.map(r=>Number(r.sleep||0)));
  const noFlour=rec.filter(r=>r.flour===0).length;
  const water=rec.filter(r=>r.water>=1.5).length;
  const diaries=rec.filter(r=>r.diaryLine).length;
  el.innerHTML=`기록 ${rec.length}일 · 평균 피부점수 ${avgScore}점 · 평균 수면 ${avgSleep}시간<br>무밀가루 ${noFlour}일 · 물 목표 ${water}일 · 피부 일기 ${diaries}일`;
}
function reportHtml(key){
  const rec=recordsForMonth(key);
  const title=key.replace('-','년 ')+'월 피부 리포트';
  const avgScore=avgSafe(rec.map(r=>r.score));
  const avgSleep=avgSafe(rec.map(r=>Number(r.sleep||0)));
  const noFlour=rec.filter(r=>r.flour===0).length;
  const water=rec.filter(r=>r.water>=1.5).length;
  const best=rec.length?rec.slice().sort((a,b)=>b.score-a.score)[0]:null;
  const diaries=rec.filter(r=>r.diaryLine);
  const photos=(state.actualPhotos||[]).filter(p=>p.date?.startsWith(key));
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#2d2926}h1{font-size:30px}h2{margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stat{padding:14px;background:#faf6f3;border-radius:14px}.stat b{display:block;font-size:22px}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.photos img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px}.diary{padding:10px 0;border-bottom:1px solid #eee}@media print{button{display:none}}</style>
  <body><h1>${title}</h1><p>Skin Reset 365 월간 기록 요약</p>
  <div class="grid"><div class="stat"><b>${rec.length}</b>기록 일수</div><div class="stat"><b>${avgScore??'-'}</b>평균 점수</div><div class="stat"><b>${avgSleep??'-'}</b>평균 수면</div><div class="stat"><b>${noFlour}</b>무밀가루 일수</div></div>
  <h2>이번 달 요약</h2><p>물 목표 달성 ${water}일 · 피부 사진 ${photos.length}장 · 최고 점수 ${best?best.score+'점 ('+best.date+')':'-'}</p>
  <h2>피부 사진</h2><div class="photos">${photos.map(p=>`<img src="${p.src}">`).join('')||'<p>사진 없음</p>'}</div>
  <h2>피부 일기</h2>${diaries.map(r=>`<div class="diary"><b>${r.date} ${r.mood||''}</b><p>${r.diaryLine}</p></div>`).join('')||'<p>작성된 일기 없음</p>'}
  <h2>미래의 나에게</h2><p>${state.futureLetter||'작성된 편지 없음'}</p>
  <button onclick="window.print()">인쇄 또는 PDF 저장</button></body></html>`;
}
function renderCapsules(){
  const box=document.getElementById('capsuleList');
  if(!box)return;
  box.innerHTML='';
  const caps=state.timeCapsules||{};
  const keys=Object.keys(caps).sort().reverse();
  if(!keys.length){box.innerHTML='<p class="sub">아직 만든 타임캡슐이 없습니다.</p>';return}
  keys.forEach(k=>{
    const c=caps[k],d=document.createElement('div');d.className='capsule-item';
    d.innerHTML=`<div><strong>${k.replace('-','년 ')}월</strong><br><span>${c.recordCount}개 기록 · ${c.photoCount}장 사진</span></div><div class="capsule-actions"><button class="secondary download">내보내기</button><button class="danger remove">삭제</button></div>`;
    d.querySelector('.download').onclick=()=>downloadTextFile(`SkinResetCapsule_${k}.skinreset`,JSON.stringify(c.payload,null,2));
    d.querySelector('.remove').onclick=()=>{if(confirm(`${k} 타임캡슐을 삭제할까요?`)){delete state.timeCapsules[k];save();renderCapsules()}};
    box.appendChild(d);
  });
}
function renderCompareOptions(){
  const before=document.getElementById('compareBefore'),after=document.getElementById('compareAfter');
  if(!before||!after)return;
  const photos=(state.actualPhotos||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const options=photos.map((p,i)=>`<option value="${i}">${p.date||'날짜 없음'} · 사진 ${i+1}</option>`).join('');
  before.innerHTML=options;after.innerHTML=options;
  if(photos.length>=2){before.value='0';after.value=String(photos.length-1)}
  renderComparison();
}
function recordForPhoto(photo){return photo?.date?state.records[photo.date]:null}
function comparePane(photo,label){
  const r=recordForPhoto(photo);
  return `<div class="compare-pane"><img src="${photo.src}"><div class="compare-info"><h3>${label} · ${photo.date||'-'}</h3><div class="compare-stats">
    <div class="compare-stat"><b>${r?.score??'-'}</b><span>피부 점수</span></div>
    <div class="compare-stat"><b>${r?.sleep??'-'}</b><span>수면 시간</span></div>
    <div class="compare-stat"><b>${r?.water??'-'}</b><span>물 L</span></div>
    <div class="compare-stat"><b>${r?['안 먹음','조금','먹음'][r.flour]:'-'}</b><span>밀가루</span></div>
  </div></div></div>`;
}
function renderComparison(){
  const before=document.getElementById('compareBefore'),after=document.getElementById('compareAfter'),view=document.getElementById('compareView'),summary=document.getElementById('compareSummary');
  if(!before||!after||!view)return;
  const photos=(state.actualPhotos||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(photos.length<2){view.innerHTML='';summary.textContent='비교하려면 실제 피부 사진이 2장 이상 필요합니다.';return}
  const p1=photos[Number(before.value||0)],p2=photos[Number(after.value||photos.length-1)];
  view.innerHTML=comparePane(p1,'이전')+comparePane(p2,'최근');
  const r1=recordForPhoto(p1),r2=recordForPhoto(p2);
  if(r1&&r2){
    const diff=r2.score-r1.score;
    summary.textContent=`피부 점수는 ${diff>0?diff+'점 상승':diff<0?Math.abs(diff)+'점 하락':'동일'}했습니다. 사진의 조명·각도 차이가 있으므로 시각 비교는 참고용입니다.`;
  }else summary.textContent='두 날짜 중 기록이 없는 날이 있어 사진 중심으로 비교합니다.';
}


function bindBackupAndCompareControls(){
  const exportBtn=document.getElementById('exportSkinreset');
  if(exportBtn&&!exportBtn.dataset.bound){
    exportBtn.dataset.bound='1';
    exportBtn.addEventListener('click',()=>{
      state.lastBackupAt=new Date().toISOString();
      save();
      downloadTextFile(`SkinResetBackup_${today()}.skinreset`,JSON.stringify(backupPayload(),null,2));
      renderBackupCenter();
      toast('백업 파일을 만들었습니다.');
    });
  }

  const chooseSkinreset=document.getElementById('chooseSkinreset');
  const importInput=document.getElementById('importSkinreset');
  if(chooseSkinreset&&!chooseSkinreset.dataset.bound){
    chooseSkinreset.dataset.bound='1';
    chooseSkinreset.addEventListener('click',()=>importInput?.click());
  }
  if(importInput&&!importInput.dataset.bound){
    importInput.dataset.bound='1';
    importInput.addEventListener('change',()=>importBackupFromInput(importInput));
  }

  const reportMonthEl=document.getElementById('reportMonth');
  if(reportMonthEl&&!reportMonthEl.dataset.bound){
    reportMonthEl.dataset.bound='1';
    reportMonthEl.addEventListener('change',renderReportPreview);
  }

  const reportBtn=document.getElementById('generateReport');
  if(reportBtn&&!reportBtn.dataset.bound){
    reportBtn.dataset.bound='1';
    reportBtn.addEventListener('click',()=>{
      const key=document.getElementById('reportMonth')?.value||monthKey();
      const rec=recordsForMonth(key);
      if(!rec.length){
        toast('선택한 달에 기록이 없습니다.');
        return;
      }
      downloadTextFile(`SkinReset_Report_${key}.html`,reportHtml(key),'text/html');
      toast('리포트를 만들었습니다.');
    });
  }

  const capsuleBtn=document.getElementById('createCapsule');
  if(capsuleBtn&&!capsuleBtn.dataset.bound){
    capsuleBtn.dataset.bound='1';
    capsuleBtn.addEventListener('click',()=>{
      const key=monthKey();
      const payload=backupPayload();
      state.timeCapsules=state.timeCapsules||{};
      state.timeCapsules[key]={
        createdAt:new Date().toISOString(),
        recordCount:recordsForMonth(key).length,
        photoCount:(state.actualPhotos||[]).filter(p=>p.date?.startsWith(key)).length,
        payload
      };
      save();
      renderCapsules();
      toast('이번 달 타임캡슐을 만들었습니다.');
    });
  }

  const before=document.getElementById('compareBefore');
  if(before&&!before.dataset.bound){
    before.dataset.bound='1';
    before.addEventListener('change',renderComparison);
  }
  const after=document.getElementById('compareAfter');
  if(after&&!after.dataset.bound){
    after.dataset.bound='1';
    after.addEventListener('change',renderComparison);
  }
}

function safeRender(name,fn){
  try{fn()}
  catch(err){
    console.error(`[Skin Reset] ${name} 렌더링 오류`,err);
  }
}
function renderAll(){
  safeRender('홈',renderHome);
  safeRender('목표',renderGoals);
  safeRender('사진·기록',renderHistory);
  safeRender('기록 폼',renderRecordForm);
  safeRender('코치·미션',renderCoachMission);
  safeRender('성장',renderGrowth);
  safeRender('설정',renderSettings);
  safeRender('백업 센터',renderBackupCenter);
  safeRender('변화 비교',renderCompareOptions);
  if(document.getElementById('quoteLibraryList'))safeRender('문구 보관함',renderQuoteLibrary);
  if(document.getElementById('flourList'))safeRender('밀가루 백과',renderFlourpedia);
  safeRender('밀가루 입력 연결',bindFlourpediaControls);
}
bindBackupAndCompareControls();
bindFlourpediaControls();
document.getElementById('recordDate').max=today();
loadRecordDate(today());
renderAll();
bindBackupAndCompareControls();

document.getElementById('exportData').onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='skin-reset-365-data.json';a.click();URL.revokeObjectURL(a.href)
};
const chooseImportData=document.getElementById('chooseImportData');
const importDataInput=document.getElementById('importData');
if(chooseImportData)chooseImportData.onclick=()=>importDataInput?.click();
if(importDataInput)importDataInput.onchange=()=>importBackupFromInput(importDataInput);
document.getElementById('resetData').onclick=()=>{if(confirm('모든 기록과 사진을 삭제할까요?')){localStorage.removeItem(KEY);state=defaultState();renderAll();toast('초기화되었습니다.')}}

document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');
  if(go)showTab(go.dataset.go);
});
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}
