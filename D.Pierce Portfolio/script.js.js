// ===== Typed Headline =====
const roles = [
  "Web Developer",
  "Cloud Engineer (AWS)",
  "Prompt Engineer",
  "AI-Accelerated Builder"
];

let i=0, j=0, deleting=false, speed=70;
const typedEl = document.getElementById("typed");
const cursorEl = document.querySelector(".cursor");

function typeLoop(){
  const word = roles[i];
  typedEl.textContent = word.substring(0, j);
  if(!deleting && j < word.length){ j++; }
  else if(deleting && j > 0){ j--; }
  else if(!deleting && j === word.length){ deleting = true; setTimeout(typeLoop, 900); return; }
  else if(deleting && j === 0){ deleting = false; i = (i+1) % roles.length; }
  setTimeout(typeLoop, deleting ? speed*0.55 : speed);
}
typeLoop();

// Blink cursor
setInterval(()=> cursorEl.classList.toggle("hide"), 450);

// ===== Year in footer =====
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Animated Counters =====
const counters = document.querySelectorAll(".num");
const counterObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const el = entry.target;
      const target = +el.getAttribute("data-target");
      let val = 0;
      const step = Math.max(1, Math.floor(target/100));
      const tick = ()=> {
        val += step;
        if(val >= target){ el.textContent = target; }
        else{ el.textContent = val; requestAnimationFrame(tick); }
      };
      tick();
      counterObserver.unobserve(el);
    }
  });
}, {threshold: .6});
counters.forEach(c => counterObserver.observe(c));

// ===== Scroll Reveal =====
const reveals = document.querySelectorAll(".reveal, .skill-card, .cs-card");
const revealObs = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add("in");
      revealObs.unobserve(entry.target);
    }
  });
}, {threshold:.2});
reveals.forEach(el => revealObs.observe(el));

// ===== Subtle mouse parallax on hero chip =====
const chip = document.querySelector(".cloud-chip");
if (chip){
  window.addEventListener("mousemove", (e)=>{
    const x = (e.clientX / window.innerWidth - .5) * 8;
    const y = (e.clientY / window.innerHeight - .5) * 8;
    chip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}

// ===== Matrix-style neon rain background (perf-friendly) =====
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
let w, h, columns, drops;

function resize(){
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  columns = Math.floor(w / 16);
  drops = Array(columns).fill(0);
}
window.addEventListener("resize", resize);
resize();

const glyphs = "01{}[]<>=/\\$#&*+Î»Æ’ÂµÎ©";
function draw(){
  ctx.fillStyle = "rgba(10,15,10,0.1)";
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = "#39ff14";
  ctx.shadowColor = "rgba(57,255,20,0.45)";
  ctx.shadowBlur = 8;

  for(let i=0; i<drops.length; i++){
    const text = glyphs[Math.floor(Math.random()*glyphs.length)];
    const x = i * 16;
    const y = drops[i] * 16;
    ctx.fillText(text, x, y);
    if(y > h && Math.random() > 0.975){ drops[i] = 0; }
    drops[i]++;
  }
  requestAnimationFrame(draw);
}
draw();

// ===== Optional: simple client-side form guard =====
const form = document.querySelector(".contact-form");
if(form){
  form.addEventListener("submit", (e)=>{
    // You can add client validations here. Keep it simple.
    // If you don't use the Flask backend, switch form action to a service like Formspree.
  });
}