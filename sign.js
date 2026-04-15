const pad=new SignaturePad(document.getElementById("sig"));
async function submitForm(){
 const sig=pad.toDataURL();
 values.signature=sig;
 alert("Saved");
}