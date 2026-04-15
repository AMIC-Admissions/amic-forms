let fields=[];
function addField(type){
 const el=document.createElement("div");
 el.innerText=type;
 el.style.position="absolute";
 el.style.left="100px";el.style.top="100px";
 el.style.background="blue";el.style.color="white";
 const key=type+Date.now();el.dataset.key=key;
 document.getElementById("canvas").appendChild(el);
 fields.push({type,key,x:100,y:100});
}
async function save(){
 const id=new URLSearchParams(location.search).get("id");
 for(const f of fields){
 await fetch("/_api/amic_fields",{method:"POST",
 headers:{"Content-Type":"application/json"},
 body:JSON.stringify({amic_key:f.key,amic_type:f.type,
 amic_documentid@odata.bind:`/amic_documents(${id})`})});
 }
 alert("Saved");
}