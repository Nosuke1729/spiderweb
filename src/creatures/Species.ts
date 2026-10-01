export type SpeciesId='fly'|'moth'|'butterfly'|'dragonfly'|'beetle'|'snail'|'frog'|'mouse';
export type Species={id:SpeciesId;name:string;flying:boolean;radius:number;lift:number;speed:number;netRadius:number;threads:number;loops:number;contacts:number;hold:number};
export const SPECIES:Record<SpeciesId,Species>={
  fly:{id:'fly',name:'Garden fly',flying:true,radius:.14,lift:.12,speed:1.18,netRadius:.2,threads:1,loops:0,contacts:1,hold:18},
  moth:{id:'moth',name:'Amber moth',flying:true,radius:.28,lift:.15,speed:.95,netRadius:1.1,threads:3,loops:1,contacts:2,hold:22},
  butterfly:{id:'butterfly',name:'Meadow butterfly',flying:true,radius:.4,lift:.22,speed:1.4,netRadius:1.5,threads:4,loops:1,contacts:2,hold:24},
  dragonfly:{id:'dragonfly',name:'Blue dragonfly',flying:true,radius:.55,lift:.3,speed:2.2,netRadius:2.2,threads:6,loops:2,contacts:3,hold:26},
  beetle:{id:'beetle',name:'Jewel beetle',flying:false,radius:.32,lift:.22,speed:.7,netRadius:1.2,threads:4,loops:1,contacts:2,hold:24},
  snail:{id:'snail',name:'Grove snail',flying:false,radius:.58,lift:.38,speed:.18,netRadius:1.8,threads:6,loops:2,contacts:3,hold:28},
  frog:{id:'frog',name:'Reed frog',flying:false,radius:.95,lift:.62,speed:1.5,netRadius:2.5,threads:8,loops:2,contacts:3,hold:30},
  mouse:{id:'mouse',name:'Wood mouse',flying:false,radius:1.18,lift:.68,speed:2.05,netRadius:3.1,threads:12,loops:3,contacts:4,hold:32},
};
