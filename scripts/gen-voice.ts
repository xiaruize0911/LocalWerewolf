// 预先生成全部语音：npm run voice
import { defaultRules } from '@lw/engine';
import { bank, detectVoice } from '../packages/server/src/voice.ts';

const rate = Number(process.env.LW_VOICE_RATE ?? defaultRules().voiceRate);
const voice = await detectVoice();
if (!voice) console.warn('没有找到中文语音，将使用系统默认语音。可以在「系统设置 → 辅助功能 → 朗读内容」中添加「婷婷」。');
console.log(`语音：${voice ?? '默认'}，语速 ${rate}`);
const t0 = Date.now();
const r = await bank(rate).pregenerateAll((d, t) => process.stdout.write(`\r生成中 ${d}/${t}   `));
console.log(`\n完成：共 ${r?.sentences ?? 0} 句，本次生成 ${r?.generated ?? 0} 个文件，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒。文件在 data/voice/`);
