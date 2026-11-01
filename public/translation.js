(()=>{
 const loc=(ru,uz,en)=>({ru,uz,en}[SATClient.lang()]||en);
 window.SATTranslate={button(url,explanation=false){if(SATClient.lang()==='en')return '';return `<div class="translation-tool"><button class="btn secondary small" data-translate="${url}" data-explanation="${explanation}">${loc('Показать перевод','Tarjimani ko‘rsatish','Show translation')}</button><div class="translation-output" role="status" hidden></div></div>`;}};
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-translate]');if(!button)return;
  const output=button.parentElement.querySelector('.translation-output');
  if(output.dataset.loaded){output.hidden=!output.hidden;return;}
  button.disabled=true;output.hidden=false;output.textContent=loc('Переводим…','Tarjima qilinmoqda…','Translating…');
  try{const result=await SATClient.api(button.dataset.translate,'POST',{lang:SATClient.lang(),explanation:button.dataset.explanation==='true'});output.replaceChildren();const note=document.createElement('p');note.className='footnote';note.textContent=loc('Машинный перевод: сверяй формулы и смысл с оригиналом.','Avtomatik tarjima: formulalar va ma’noni asl matn bilan tekshiring.','Machine translation: check formulas and meaning against the original.');output.append(note);for(const text of result.parts){if(!text)continue;const p=document.createElement('p');p.textContent=text;output.append(p);}output.dataset.loaded='true';}
  catch(error){output.textContent=SATI18N.error(error);}finally{button.disabled=false;}
 });
})();
