import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {preloadDetailedPatient} from '../../scene/DetailedPatient';
import {setPatientAppearance} from '../../interaction/patientAppearance';
beforeAll(async()=>{const data=JSON.parse(readFileSync(new URL('../../../public/assets/patient-prototype/patient.json', import.meta.url),'utf8'));vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>data}));const spy=vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockResolvedValue(new THREE.Texture());await preloadDetailedPatient();spy.mockRestore();vi.unstubAllGlobals();});
beforeEach(()=>setPatientAppearance('detailed'));afterEach(()=>setPatientAppearance('current'));
