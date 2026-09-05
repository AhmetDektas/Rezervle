// Worker sürecinin giriş noktası: `npm run worker`.
// Buradaki tek iş, tanımlı işleri içe aktarıp kayıt defterini doldurmak;
// asıl mantık index.ts içinde ve orası birim testleriyle kapsanıyor.
import { main } from './index';

main();
