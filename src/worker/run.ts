// Worker sürecinin giriş noktası: `npm run worker`.
//
// **`--conditions=react-server` ŞART.** `src/server/*` modülleri
// `import 'server-only'` taşıyor ve o paket düz Node sürecinde koşulsuz hata
// fırlatıyor — worker hiç açılmıyordu. `react-server` koşulunda paket boş
// modüle çözülüyor ve worker gerçekten bir sunucu bağlamı olduğu için bu
// semantik olarak da doğru. Koşul kaldırılırsa worker sessizce değil,
// gürültülü şekilde ölür; yine de package.json'daki komutu değiştirmeyin.
//
// Buradaki tek iş main()'i çağırmak; işlerin kaydı index.ts'teki
// `./jobs` importuyla doluyor ve asıl mantık orada.
import { main } from './index';

main();
