let values={};
function update(k,v){
 values[k]=v;
 document.querySelectorAll(`[data-key="${k}"]`).forEach(e=>e.value=v);
}