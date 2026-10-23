import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, Building2, CheckCircle2, ChevronDown, Clock3, Hammer, HardHat, MapPin, Menu, MessageCircle, Phone, Ruler, ShieldCheck, X } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const PHONE = import.meta.env.VITE_PHONE_NUMBER || "";
const WHATSAPP = (import.meta.env.VITE_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const demoProjects = [
  { _id:"demo-1", title:"Residential Construction", category:"New Construction", location:"Delhi NCR", description:"A sample portfolio card. Replace with an actual RK Construction project.", imageUrl:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85", featured:true },
  { _id:"demo-2", title:"Home Renovation", category:"Renovation", location:"Delhi NCR", description:"A sample portfolio card. Replace with an actual RK Construction project.", imageUrl:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" },
  { _id:"demo-3", title:"Civil & Finishing Work", category:"Civil Work", location:"Delhi NCR", description:"A sample portfolio card. Replace with an actual RK Construction project.", imageUrl:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85" }
];
const services = [
  { icon: Building2, number:"01", title:"New Construction", text:"From planning and foundational work to structure and finishing, discuss your new residential or commercial build with our team." },
  { icon: Ruler, number:"02", title:"Renovation", text:"Refresh an existing space with renovation work planned around your requirements, site conditions and budget." },
  { icon: Hammer, number:"03", title:"Civil Work", text:"Enquire about masonry, plastering, tiling and other civil work for your property." }
];
function waLink(message="Hello RK Construction, I would like to discuss a construction project.") {
  return WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}` : "#contact";
}
function Header() {
  const [open,setOpen] = useState(false);
  const links = [["Services","#services"],["Projects","#projects"],["About","#about"],["Contact","#contact"]];
  return <header className="header"><a className="brand" href="#home" aria-label="RK Construction home"><span className="brand-mark"><Building2 size={25}/></span><span><strong>RK <b>CONSTRUCTION</b></strong><small>BUILDING WITH INTEGRITY</small></span></a>
    <button className="menu-toggle" onClick={()=>setOpen(!open)} aria-label="Toggle navigation">{open?<X/>:<Menu/>}</button>
    <nav className={open?"nav nav-open":"nav"}>{links.map(([label,href])=><a key={href} href={href} onClick={()=>setOpen(false)}>{label}</a>)}<a className="nav-cta" href="#contact" onClick={()=>setOpen(false)}>Get an Estimate <ArrowRight size={16}/></a></nav>
  </header>;
}
function SectionLabel({children}) { return <div className="eyebrow"><span/>{children}</div>; }
function ProjectCard({project}) { return <article className="project-card"><div className="project-image"><img src={project.imageUrl} alt={`${project.title} project`} loading="lazy"/><span className="project-category">{project.category}</span><a className="project-arrow" href="#contact" aria-label={`Enquire about ${project.title}`}><ArrowDownRight/></a></div><div className="project-copy"><div><h3>{project.title}</h3><p><MapPin size={14}/>{project.location}</p></div><span className="project-index">RK / WORK</span></div></article>; }
function EnquiryForm() {
  const [form,setForm] = useState({name:"",phone:"",email:"",projectType:"New Construction",location:"",budget:"",message:""});
  const [state,setState] = useState({loading:false,error:"",success:""});
  const change = e => setForm({...form,[e.target.name]:e.target.value});
  async function submit(e) {
    e.preventDefault(); setState({loading:true,error:"",success:""});
    try {
      const res = await fetch(`${API}/enquiries`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data = await res.json();
      if(!res.ok) throw new Error(data.message || "Could not send your enquiry.");
      setState({loading:false,error:"",success:"Thank you! Your enquiry has been received."});
      setForm({name:"",phone:"",email:"",projectType:"New Construction",location:"",budget:"",message:""});
    } catch(err) {
      setState({loading:false,error:err.message || "The enquiry service is not connected yet. Please use WhatsApp or call.",success:""});
    }
  }
  return <form className="enquiry-form" onSubmit={submit}>
    <div className="form-heading"><span>START A CONVERSATION</span><h3>Tell us about your project.</h3><p>Share a few details and the team can follow up with you.</p></div>
    {state.success&&<div className="notice success"><CheckCircle2 size={18}/>{state.success}</div>}
    {state.error&&<div className="notice error">{state.error} {WHATSAPP&&<a href={waLink()}>Message us on WhatsApp</a>}</div>}
    <div className="form-grid">
      <label>Your name *<input name="name" value={form.name} onChange={change} required minLength="2" maxLength="100" placeholder="Full name"/></label>
      <label>Phone number *<input name="phone" value={form.phone} onChange={change} required pattern="[+()0-9 -]{8,20}" placeholder="+91"/></label>
      <label>Email (optional)<input name="email" type="email" value={form.email} onChange={change} placeholder="you@example.com"/></label>
      <label>Project type *<select name="projectType" value={form.projectType} onChange={change}><option>New Construction</option><option>Renovation</option><option>Civil Work</option><option>Commercial</option><option>Other</option></select></label>
      <label>Project location *<input name="location" value={form.location} onChange={change} required maxLength="160" placeholder="Area / city"/></label>
      <label>Estimated budget<select name="budget" value={form.budget} onChange={change}><option value="">Choose a range</option><option>Under ₹5 lakh</option><option>₹5–15 lakh</option><option>₹15–30 lakh</option><option>₹30 lakh+</option><option>Need guidance</option></select></label>
      <label className="full">Project details *<textarea name="message" value={form.message} onChange={change} required minLength="10" maxLength="2000" rows="4" placeholder="What would you like to build or renovate?"/></label>
    </div>
    <button className="button button-dark form-submit" disabled={state.loading}>{state.loading?"Sending enquiry…":"Send project enquiry"}<ArrowRight size={17}/></button>
    <small className="privacy-note">Your details will be used to respond to this project enquiry.</small>
  </form>;
}
function App() {
  const [projects,setProjects] = useState(demoProjects);
  const [filter,setFilter] = useState("All");
  const [apiReady,setApiReady] = useState(false);
  const categories = ["All","New Construction","Renovation","Civil Work"];
  const visibleProjects = useMemo(()=>projects.filter(p=>filter==="All"||p.category===filter),[projects,filter]);
  useEffect(()=>{fetch(`${API}/projects`).then(r=>r.ok?r.json():Promise.reject()).then(d=>{setProjects(d.projects?.length?d.projects:demoProjects);setApiReady(true)}).catch(()=>{});},[]);
  return <><Header/><main>
    <section className="hero" id="home"><div className="hero-photo" aria-hidden="true"/><div className="hero-shade"/><div className="hero-content"><SectionLabel>CONSTRUCTION & CIVIL WORK · KAROL BAGH, DELHI</SectionLabel><h1>Built on trust.<br/><em>Made to last.</em></h1><p>Thoughtful construction, dependable civil work and renovation solutions for the spaces that matter to you.</p><div className="hero-actions"><a className="button button-gold" href="#contact">Discuss your project <ArrowRight size={17}/></a><a className="text-link light" href="#projects">Explore our work <ArrowDownRight size={17}/></a></div><div className="hero-note"><span className="note-line"/><span>LOCAL KNOWLEDGE. HANDS-ON SERVICE.</span></div></div><div className="hero-side-label">RK CONSTRUCTION — DELHI</div></section>
    <section className="trust-strip"><div><span className="strip-number">01</span><p>Clear communication</p></div><div><span className="strip-number">02</span><p>Work planned around your needs</p></div><div><span className="strip-number">03</span><p>Local project discussions</p></div><div className="strip-location"><MapPin size={17}/><span>Karol Bagh, New Delhi</span></div></section>
    <section className="section services-section" id="services"><div className="section-intro"><SectionLabel>WHAT WE DO</SectionLabel><h2>Practical expertise.<br/><em>Solid foundations.</em></h2><p>Every project starts with understanding the site, the scope and what matters most to you. Talk to RK Construction about your requirements.</p><a className="text-link" href="#contact">Talk through your project <ArrowRight size={16}/></a></div><div className="service-list">{services.map(({icon:Icon,number,title,text})=><article className="service-item" key={number}><div className="service-top"><span>{number} / SERVICE</span><Icon size={24} strokeWidth={1.5}/></div><h3>{title}</h3><p>{text}</p><a href="#contact" aria-label={`Enquire about ${title}`}><ArrowDownRight size={19}/></a></article>)}</div></section>
    <section className="projects-section section" id="projects"><div className="projects-heading"><div><SectionLabel>SELECTED WORK</SectionLabel><h2>Spaces shaped<br/>with <em>purpose.</em></h2></div><p>A portfolio of project work belongs here. Browse the examples, then contact us to discuss a project like yours.</p></div><div className="filters" role="group" aria-label="Filter projects">{categories.map(c=><button key={c} onClick={()=>setFilter(c)} className={filter===c?"filter active":"filter"}>{c}</button>)}</div><div className="project-grid">{visibleProjects.map(p=><ProjectCard project={p} key={p._id}/>)}</div>{!apiReady&&<p className="demo-note">Preview images shown for layout demonstration. Add real project photos through the admin dashboard before publishing.</p>}<div className="projects-bottom"><span>HAVE A PROJECT IN MIND?</span><a className="text-link" href="#contact">Let's discuss it <ArrowRight size={16}/></a></div></section>
    <section className="about-section" id="about"><div className="about-image"><img src="https://images.unsplash.com/photo-1503387762-592deen9ef4?auto=format&fit=crop&w=1200&q=85" alt="Architectural construction detail" loading="lazy"/><div className="image-stamp"><HardHat size={24}/><span>BUILT WITH<br/>PURPOSE</span></div></div><div className="about-copy"><SectionLabel>ABOUT RK CONSTRUCTION</SectionLabel><h2>Your project deserves<br/><em>care at every stage.</em></h2><p>Whether you are planning a new build, upgrading an existing property or looking for civil work, a clear conversation is the first step.</p><p>RK Construction is based in Karol Bagh, Delhi. Get in touch to discuss your site, timeline, scope and estimate.</p><div className="about-points"><div><ShieldCheck/><span><strong>Scope-first approach</strong><small>Discuss requirements before work begins.</small></span></div><div><Clock3/><span><strong>Planning and coordination</strong><small>Talk through expected timelines and next steps.</small></span></div></div><a className="button button-dark" href="#contact">Get in touch <ArrowRight size={17}/></a></div></section>
    <section className="contact-section section" id="contact"><div className="contact-intro"><SectionLabel>LET'S BUILD SOMETHING</SectionLabel><h2>Have a project<br/>in <em>mind?</em></h2><p>Tell us what you have planned. Start with a conversation about the site, scope and estimate.</p><div className="contact-methods"><a href={PHONE?`tel:${PHONE}`:"#contact"}><span className="method-icon"><Phone/></span><span><small>CALL RK CONSTRUCTION</small><strong>{PHONE||"Add business phone number"}</strong></span><ArrowRight size={17}/></a><a href={waLink()} target={WHATSAPP?"_blank":undefined} rel={WHATSAPP?"noreferrer":undefined}><span className="method-icon"><MessageCircle/></span><span><small>WHATSAPP ENQUIRIES</small><strong>{WHATSAPP?"Chat with our team":"Add WhatsApp number"}</strong></span><ArrowRight size={17}/></a><div className="location-row"><span className="method-icon"><MapPin/></span><span><small>OUR BASE</small><strong>Karol Bagh, Delhi, India</strong></span></div></div></div><EnquiryForm/></section>
    <section className="last-cta"><div><span>READY TO GET STARTED?</span><h2>Let's make a solid plan.</h2></div><a className="button button-gold" href="#contact">Start an enquiry <ArrowRight size={17}/></a></section>
  </main><footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Building2 size={23}/></span><span><strong>RK <b>CONSTRUCTION</b></strong><small>BUILDING WITH INTEGRITY</small></span></a><p>Construction · Renovation · Civil Work</p><div><a href="#services">Services</a><a href="#projects">Projects</a><a href="#contact">Contact</a><a href="/admin">Admin</a></div><small>© {new Date().getFullYear()} RK Construction. All rights reserved.</small></footer>
    <div className="mobile-actions"><a href={PHONE?`tel:${PHONE}`:"#contact"}><Phone size={17}/> Call</a><a href={waLink()}><MessageCircle size={17}/> WhatsApp</a></div>
  </>;
}
export default App;
