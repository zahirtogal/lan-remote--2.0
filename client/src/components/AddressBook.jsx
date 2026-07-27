import { useState, useEffect } from 'react';
import { User, Monitor, Trash2, Edit2, Plus, ArrowRight, X, Clock, Book } from 'lucide-react';

const STORAGE_KEY = 'lan_remote_address_book';

const AddressBook = ({ onConnect }) => {
    const [devices, setDevices] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEditId, setCurrentEditId] = useState(null);

    // Recent connections
    const [recentConnections, setRecentConnections] = useState([]);

    // Form State
    const [formData, setFormData] = useState({ name: '', remoteId: '', note: '' });

    useEffect(() => {
        loadDevices();
        loadRecent();

        const handleRecent = () => loadRecent();
        window.addEventListener('recentConnectionsUpdated', handleRecent);
        return () => window.removeEventListener('recentConnectionsUpdated', handleRecent);
    }, []);

    const loadDevices = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setDevices(JSON.parse(saved));
            } catch (e) {
                console.error("Local storage veri çözümleme hatası:", e);
            }
        }
    };

    const loadRecent = () => {
        const saved = localStorage.getItem('lan_remote_recent_connections');
        if (saved) {
            try {
                setRecentConnections(JSON.parse(saved));
            } catch (e) {
                console.error("Recent connections parse error:", e);
            }
        }
    };

    const saveToStorage = (newDevices) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newDevices));
        setDevices(newDevices);
    };

    const handleOpenModal = (device = null, defaultId = '') => {
        if (device) {
            setFormData({ name: device.name, remoteId: device.remoteId, note: device.note || '' });
            setCurrentEditId(device.id);
        } else {
            setFormData({ name: '', remoteId: defaultId, note: '' });
            setCurrentEditId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({ name: '', remoteId: '', note: '' });
        setCurrentEditId(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.name.trim() === '' || formData.remoteId.trim().length !== 6) return; // Basic validation

        let newDevices = [...devices];

        if (currentEditId) {
            newDevices = newDevices.map(d =>
                d.id === currentEditId ? { ...d, ...formData, updatedAt: new Date().toISOString() } : d
            );
        } else {
            // Check if it already exists by remoteId to prevent exact duplicates (optional)
            const newDevice = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                ...formData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            newDevices.push(newDevice);
        }

        saveToStorage(newDevices);
        handleCloseModal();
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        if (window.confirm("Bu cihazı adres defterinden silmek istediğinize emin misiniz?")) {
            const newDevices = devices.filter(d => d.id !== id);
            saveToStorage(newDevices);
        }
    };

    const handleConnect = (remoteId, e) => {
        if (e) e.stopPropagation();
        onConnect(remoteId);
    };

    return (
        <div className="w-full max-w-5xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                    <Book className="w-5 h-5 text-primary" /> Adres Defteri
                </h3>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all border border-primary/20 hover:border-transparent cursor-pointer"
                >
                    <Plus className="w-4 h-4" /> Yeni Cihaz
                </button>
            </div>

            {/* Recent Connections Banner */}
            {recentConnections.length > 0 && (
                <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Son Bağlanılanlar (Geçmiş)
                    </h4>
                    <div className="flex flex-wrap gap-3">
                        {recentConnections.map(r => {
                            const isSaved = devices.some(d => d.remoteId === r.id);
                            return (
                                <div key={r.id} className="bg-zinc-800 border border-zinc-700 hover:border-primary/50 transition-colors rounded-lg flex items-center pr-1.5 pl-3 py-1 gap-2 shadow-sm">
                                    <span className="text-sm font-mono text-zinc-200 tracking-wider font-semibold">{r.id}</span>
                                    <div className="flex gap-1 ml-2 border-l border-zinc-700 pl-2">
                                        <button
                                            onClick={(e) => handleConnect(r.id, e)}
                                            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-600 rounded-md transition-colors cursor-pointer"
                                            title="Hızlı Bağlan"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                        {!isSaved && (
                                            <button
                                                onClick={() => handleOpenModal(null, r.id)}
                                                className="p-1.5 text-zinc-400 hover:text-primary bg-zinc-900 hover:bg-primary/20 rounded-md transition-colors cursor-pointer"
                                                title="Adres Defterine Ekle"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Grid List */}
            {devices.length === 0 ? (
                <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
                    <Monitor className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Henüz kayıtlı bir cihaz yok.</p>
                    <p className="text-xs mt-2">Sık bağlandığınız cihazları ekleyerek veya geçmişten seçerek hızlıca erişin.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map((device) => (
                        <div
                            key={device.id}
                            onClick={() => handleConnect(device.remoteId)}
                            className="group bg-zinc-900 border border-zinc-800 hover:border-primary/50 relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)] hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-4 relative">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700/50">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-zinc-100 m-0 truncate w-32">{device.name}</h4>
                                        <span className="text-xs font-mono text-primary flex items-center gap-1">
                                            {device.remoteId}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(device); }}
                                        className="p-1.5 text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(device.id, e)}
                                        className="p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-800/50 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <p className="text-sm text-zinc-500 mb-4 line-clamp-2 min-h-[40px] relative">
                                {device.note || "Not eklenmedi."}
                            </p>

                            <div className="flex justify-between items-center relative pt-4 border-t border-zinc-800/50">
                                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Son gnc: {new Date(device.updatedAt).toLocaleDateString()}
                                </span>
                                <span className="text-xs font-medium text-white group-hover:text-primary transition-colors flex items-center gap-1">
                                    Bağlan <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[2000] flex justify-center items-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={handleCloseModal}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-6">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-zinc-100">
                                {currentEditId ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                {currentEditId ? "Cihazı Düzenle" : "Yeni Cihaz Ekle"}
                            </h2>

                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Cihaz Adı</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Örn: Ev Bilgisayarı"
                                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-primary rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Uzak ID (6 Hane)</label>
                                        <input
                                            type="text"
                                            maxLength="6"
                                            value={formData.remoteId}
                                            onChange={(e) => setFormData({ ...formData, remoteId: e.target.value.replace(/[^0-9]/g, '') })}
                                            required
                                            placeholder="123456"
                                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-primary rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all font-mono tracking-widest"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Not / Açıklama (Opsiyonel)</label>
                                        <textarea
                                            value={formData.note}
                                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                            placeholder="Bağlantı şifresi vs."
                                            rows="3"
                                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-primary rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-none"
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="mt-8 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-lg transition-colors text-sm cursor-pointer"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formData.remoteId.length !== 6 || !formData.name.trim()}
                                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-colors text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {currentEditId ? "Güncelle" : "Kaydet"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddressBook;
