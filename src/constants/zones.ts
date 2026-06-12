export interface ZoneConfig {
  id: string;
  name: string;
  description?: string;
  imageUrl: string | null;
}

export const ZONE_MAPS: Record<string, ZoneConfig> = {
  'A': { id: 'A', name: 'ZONE BOX', imageUrl: null },
  'B': { id: 'B', name: 'SH1-SHELVING UNIT1', description: 'ชั้นวางที่ 1', imageUrl: null },
  'C': { id: 'C', name: 'รถเข็นพยาบาล', imageUrl: null },
  'D': { id: 'D', name: 'SH2-SHELVING UNIT2', description: 'ชั้นวางที่ 2', imageUrl: null },
  'E': { id: 'E', name: 'ZONE BOX ART 1', imageUrl: null },
  'F': { id: 'F', name: 'ZONE BOX ART 2', imageUrl: null },
  'G': { id: 'G', name: 'ถุงรองเท้า', imageUrl: null },
  'H': { id: 'H', name: 'BOX WD', imageUrl: null },
  'I': { id: 'I', name: 'ZONE BOX ART 3', imageUrl: null },
  'J': { id: 'J', name: 'SH-YLW YELLOW SHELVING', description: 'ชั้นวางสีเหลือง', imageUrl: null },
  'K': { id: 'K', name: 'ZONE BOX ART 4', imageUrl: null },
  'L': { id: 'L', name: 'FOAM ZONE', imageUrl: null },
  'M': { id: 'M', name: 'ZONE BOX ART 5', imageUrl: null },
};
