// funcionalidad dinamica traslate

// Firebase Configuración
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cargar palabras desde Firebase
async function loadWords() {
  const kamentsaList = document.getElementById("kamentsaWords");
  const spanishList = document.getElementById("spanishWords");
  
  // Limpiar listas
  kamentsaList.innerHTML = "";
  spanishList.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "translations"));
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    
    // Crear elementos de lista
    const kamentsaItem = document.createElement("li");
    kamentsaItem.textContent = data.wordKamentsa;

    const spanishItem = document.createElement("li");
    spanishItem.textContent = data.wordSpanish;

    // Agregar al DOM
    kamentsaList.appendChild(kamentsaItem);
    spanishList.appendChild(spanishItem);
  });
}

// Filtro de palabras
function filterWords() {
  const searchTerm = document.getElementById("searchBar").value.toLowerCase();
  const kamentsaItems = document.querySelectorAll("#kamentsaWords li");
  const spanishItems = document.querySelectorAll("#spanishWords li");

  kamentsaItems.forEach((item, index) => {
    if (item.textContent.toLowerCase().includes(searchTerm)) {
      item.style.display = "block";
      spanishItems[index].style.display = "block";
    } else {
      item.style.display = "none";
      spanishItems[index].style.display = "none";
    }
  });
}

// Mostrar ejemplos contextuales
function showExamples() {
  const examplesArea = document.getElementById("examplesArea");
  examplesArea.classList.toggle("hidden");
}

// Cargar palabras al inicio
loadWords();
