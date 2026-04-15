async function upload(){
 const file=document.getElementById("file").files[0];
 if(!file)return alert("Upload file");
 await fetch("/_api/amic_documents",{method:"POST",
 headers:{"Content-Type":"application/json"},
 body:JSON.stringify({amic_name:file.name})});
 load();
}
async function load(){
 const res=await fetch("/_api/amic_documents?$select=amic_name,amic_documentid");
 const data=await res.json();
 const table=document.getElementById("list");
 table.innerHTML="";
 data.value.forEach(d=>{
 table.innerHTML+=`<tr><td>${d.amic_name}</td>
 <td><button onclick="go('${d.amic_documentid}')">Builder</button></td></tr>`;
 });
}
function go(id){location.href="../builder/builder.html?id="+id;}
load();