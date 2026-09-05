import { world, system } from "@minecraft/server";

const MACHINES = new Map();
const TICK_MS = 100;

function keyOf(dim, loc) { return `${dim.id}:${loc.x},${loc.y},${loc.z}`; }
function isNearMachine(loc, m) { return Math.abs(loc.x-m.x)<=1 && Math.abs(loc.z-m.z)<=1 && loc.y>=m.y && loc.y<=m.y+1; }

world.afterEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  if (!item || item.typeId !== "coinpusher:token") return;
  const p = ev.source;
  const b = p.dimension.getBlock(p.location);
  if (!b) return;

  let found;
  for (const m of MACHINES.values()) if (m.dim === p.dimension.id && isNearMachine(p.location, m)) { found=m; break; }
  if (!found) return;
  if (found.running) return;

  found.running = true;
  found.progress = 0;
  p.runCommandAsync("clear @s coinpusher:token 1");
  p.runCommandAsync(`playsound random.click @s`);
});

world.afterEvents.playerPlaceBlock.subscribe((ev) => {
  const b = ev.block;
  if (b.typeId !== "minecraft:gold_block") return;
  const above = b.dimension.getBlock({x:b.location.x,y:b.location.y+1,z:b.location.z});
  if (!above || above.typeId !== "minecraft:gold_block") return;
  const k=keyOf(b.dimension,b.location);
  MACHINES.set(k,{dim:b.dimension.id,x:b.location.x,y:b.location.y,z:b.location.z,running:false,progress:0});
});

world.afterEvents.playerBreakBlock.subscribe((ev)=>{
  const k=keyOf(ev.block.dimension,ev.block.location);
  MACHINES.delete(k);
});

system.runInterval(()=>{
  for (const m of MACHINES.values()) {
    if (!m.running) continue;
    m.progress += 1;
    const dim=world.getDimension(m.dim);
    const x=m.x, y=m.y, z=m.z;
    // Visible mechanical cycle: piston-like plate represented by temporary blocks moving across the 2x2 cabinet.
    const phase=m.progress%12;
    const plateX=phase<6 ? x-1+phase/5 : x-1+(12-phase)/5;
    const px=Math.floor(plateX);
    for(let dz=0;dz<2;dz++) {
      const block=dim.getBlock({x:px,y:y,z:z+dz});
      if(block && block.typeId === "minecraft:gold_block") {
        try { block.setType("minecraft:iron_block"); } catch {}
      }
    }
    if(m.progress>=36) {
      m.running=false;
      m.progress=0;
      try { dim.runCommandAsync(`particle minecraft:basic_flame_particle ${x} ${y+1} ${z}`); } catch {}
    }
  }
},2);
