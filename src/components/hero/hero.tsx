import { AuthButtons } from "../auth/signup/signup-button";
import { ThemeToggle } from "../themeToggle/themeToggle";
import { HeroButtons } from "./hero-buttons";
import { TypingText } from "./typing-text";

export function Hero() {
    return (
        <section className="min-h-screen">
            <div className="flex w-full justify-between">
                <ThemeToggle />
                <AuthButtons/>
            </div>
            <div className="mx-auto flex min-h-screen max-w-7x1 flex-col items-center justify-center">
                <h1 className="text-7xl font-bold">Engineering Playground</h1>
                <TypingText
                    words={[
                        "Hello World",          // Inglês
                        "Hola Mundo",           // Espanhol
                        "Olá Mundo",            // Português
                        "Bonjour le Monde",     // Francês
                        "Ciao Mondo",           // Italiano
                        "Hallo Welt",           // Alemão
                        "Hallo Wereld",         // Holandês
                        "Hei Verden",           // Norueguês
                        "Hej Värld",            // Sueco
                        "Hej Verden",           // Dinamarquês
                        "Hei Maailma",          // Finlandês
                        "Halo Dunia",           // Indonésio / Malaio
                        "Salam Dunia",          // Persa (Farsi)
                        "Ahoj Světe",           // Tcheco
                        "Witaj Świecie",        // Polonês
                        "Helló Világ",          // Húngaro
                        "Salut Lume",           // Romeno
                        "Здравей, свят",        // Búlgaro
                        "Привет, мир",          // Russo
                        "Привіт, світе",        // Ucraniano
                        "Салам Дүйнө",          // Quirguiz
                        "Здравствуй, мир",      // Bielorrusso
                        "Γειά σου Κόσμε",       // Grego
                        "Merhaba Dünya",        // Turco
                        "שלום עולם",            // Hebraico
                        "مرحباً يا عالم",       // Árabe
                        "नमस्ते दुनिया",         // Hindi
                        "হ্যালো ওয়ার্ল্ড",       // Bengali
                        "ਹੈਲੋ ਵਰਲਡ",            // Punjabi
                        "ஹலோ வேர்ல்ட்",        // Tâmil
                        "హロー వరల్డ్",        // Telugu
                        "ഹലോ വേൾഡ്",          // Malayalam
                        "สวัสดีชาวโลก",         // Tailandês
                        "Chào thế giới",        // Vietnamita
                        "Mingalaba Kabar",      // Birmanês
                        "こんにちは世界",        // Japonês
                        "안녕하세요 세계",        // Coreano
                        "你好世界",             // Chinês (Simplificado)
                        "你好世界",             // Chinês (Tradicional)
                        "Kumusta Mundo",        // Tagalo (Filipino)
                        "Mambo Dunia",          // Suaíli
                        "Lefatshe Lea Lumela",  // Sotho
                        "Sawubona Mhlaba",      // Zulu
                        "Kaixo Mundua",         // Basco
                        "Dia daoibh, a dhomhain" // Irlandês
                    ]}
                />
                <p className="">Where Software Engineering meets creativity.</p>
                <div>
                    <HeroButtons />
                </div>
                <div>
                </div>
            </div>
        </section>
    )
}