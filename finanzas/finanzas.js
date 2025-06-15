window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM listo");

  // Inicializar Google Charts
  google.charts.load('current', { packages: ['corechart'] });
  google.charts.setOnLoadCallback(() => console.log("✅ Google Charts cargado"));

  const firebaseConfig = {
    apiKey: "AIzaSyCxCWZRHoEvayokHNkoavBaa8_o7vr1SiE",
    authDomain: "drg-app-a654e.firebaseapp.com",
    projectId: "drg-app-a654e",
    storageBucket: "drg-app-a654e.appspot.com",
    messagingSenderId: "853577402845",
    appId: "1:853577402845:web:9c7ae221db8bf986cc0e34",
    measurementId: "G-PWZF6M6NKZ"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let uid = null;

  const fuentesIngreso = ["Trabajo", "Negocio", "Inversiones", "Otros"];
  const fuentesEgreso = ["Hogar", "Salud", "Alimentación", "Estilo de vida", "Inversión", "Otros"];

  auth.onAuthStateChanged(user => {
    if (user) {
      uid = user.uid;
      cargarEntradasGuardadas();
    } else {
      uid = "modo_demo";
      document.getElementById("mensaje").innerText = "⚠️ Modo demo activo. Los datos no se guardarán.";
      agregarFila();
    }
  });

  function cargarEntradasGuardadas() {
    db.collection("usuarios").doc(uid).collection("finanzas").get()
      .then(snapshot => {
        const datos = [];
        const tbody = document.getElementById("cuerpoTabla");
        tbody.innerHTML = "";

        snapshot.forEach(doc => {
          const data = doc.data();
          const row = document.createElement("tr");
          row.innerHTML = `
            <td><input type="date" value="${data.fecha}" required></td>
            <td><select required><option value="Ingreso" ${data.tipo === "Ingreso" ? "selected" : ""}>Ingreso</option><option value="Egreso" ${data.tipo === "Egreso" ? "selected" : ""}>Egreso</option></select></td>
            <td><select required></select></td>
            <td><input type="text" value="${data.glosa}" required></td>
            <td><input type="number" value="${data.monto}" step="0.01" required></td>
            <td><input type="number" value="${data.porcentaje}" step="0.01"></td>
            <td><span>${data.ahorro.toFixed(2)}</span></td>`;
          tbody.appendChild(row);
          const tipoSelect = row.cells[1].querySelector("select");
          actualizarFuente(tipoSelect);
          row.cells[2].querySelector("select").value = data.fuente;
          agregarEventos(row);
          datos.push({ tipo: data.tipo, fuente: data.fuente, monto: data.monto });
        });

        generarGraficos(datos);
      })
      .catch(err => {
        console.error("Error al cargar datos:", err);
        document.getElementById("mensaje").innerText = "❌ Error al cargar datos.";
      });
  }

  function agregarFila() {
    const tbody = document.getElementById("cuerpoTabla");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="date" required></td>
      <td><select required><option value="Ingreso">Ingreso</option><option value="Egreso">Egreso</option></select></td>
      <td><select required></select></td>
      <td><input type="text" placeholder="Escribe glosa" required></td>
      <td><input type="number" step="0.01" required></td>
      <td><input type="number" value="10" step="0.01"></td>
      <td><span>0.00</span></td>`;
    tbody.appendChild(row);
    const tipoSelect = row.cells[1].querySelector("select");
    tipoSelect.addEventListener("change", function () {
      actualizarFuente(this);
      calcularAhorro(row);
    });
    actualizarFuente(tipoSelect);
    agregarEventos(row);
  }

  function actualizarFuente(select) {
    const row = select.closest("tr");
    const tipo = select.value;
    const fuentes = tipo === "Ingreso" ? fuentesIngreso : fuentesEgreso;
    const fuenteSelect = row.cells[2].querySelector("select");
    fuenteSelect.innerHTML = "";
    fuentes.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      fuenteSelect.appendChild(opt);
    });
  }

  function agregarEventos(row) {
    const inputs = row.querySelectorAll("input, select");
    inputs.forEach(input => input.addEventListener("input", () => {
      calcularAhorro(row);
      generarGraficos(obtenerDatosTabla());
    }));
  }

  function calcularAhorro(row) {
    const tipo = row.cells[1].querySelector("select").value;
    const montoInput = row.cells[4].querySelector("input");
    const porcentajeInput = row.cells[5].querySelector("input");
    const monto = Math.abs(parseFloat(montoInput.value.replace(",", "."))) || 0;
    montoInput.value = monto.toFixed(2);
    const porcentaje = parseFloat(porcentajeInput.value) || 0;
    const ahorro = (tipo === "Ingreso") ? (monto * porcentaje / 100).toFixed(2) : "0.00";
    row.cells[6].querySelector("span").textContent = ahorro;
  }

  function obtenerDatosTabla() {
    const filas = document.querySelectorAll("#cuerpoTabla tr");
    const datos = [];
    filas.forEach(row => {
      const tipo = row.cells[1].querySelector("select").value;
      const fuente = row.cells[2].querySelector("select").value;
      const monto = Math.abs(parseFloat(row.cells[4].querySelector("input").value.replace(",", "."))) || 0;
      datos.push({ tipo, fuente, monto });
    });
    return datos;
  }

  function guardarEntradas() {
    const filas = document.querySelectorAll("#cuerpoTabla tr");
    if (uid === "modo_demo") {
      document.getElementById("mensaje").innerText = "❌ No puedes guardar en modo demo.";
      generarGraficos(obtenerDatosTabla());
      return;
    }
    const batch = db.batch();
    const datos = [];
    filas.forEach(row => {
      const fecha = row.cells[0].querySelector("input").value;
      const tipo = row.cells[1].querySelector("select").value;
      const fuente = row.cells[2].querySelector("select").value;
      const glosa = row.cells[3].querySelector("input").value;
      const monto = Math.abs(parseFloat(row.cells[4].querySelector("input").value.replace(",", "."))) || 0;
      const porcentaje = parseFloat(row.cells[5].querySelector("input").value) || 0;
      const ahorro = parseFloat(row.cells[6].querySelector("span").textContent) || 0;
      const ref = db.collection("usuarios").doc(uid).collection("finanzas").doc();
      batch.set(ref, { fecha, tipo, fuente, glosa, monto, porcentaje, ahorro });
      datos.push({ tipo, fuente, monto });
    });
    batch.commit().then(() => {
      document.getElementById("mensaje").innerText = "✅ Registros guardados con éxito.";
      generarGraficos(datos);
    }).catch(err => {
      document.getElementById("mensaje").innerText = "❌ Error al guardar: " + err.message;
    });
  }

  function generarGraficos(datos) {
    const ingresos = {}, egresos = {};

    datos.forEach(({ tipo, fuente, monto }) => {
      if (!fuente || isNaN(monto)) return;
      if (tipo === "Ingreso") ingresos[fuente] = (ingresos[fuente] || 0) + monto;
      else if (tipo === "Egreso") egresos[fuente] = (egresos[fuente] || 0) + monto;
    });

    const dibujar = (mapa, contenedor, titulo) => {
      const dataArray = [["Fuente", "Monto"]];
      for (const key in mapa) {
        dataArray.push([key, mapa[key]]);
      }
      if (dataArray.length === 1) dataArray.push(["Sin datos", 1]);

      const data = google.visualization.arrayToDataTable(dataArray);
      const options = {
        title: titulo,
        pieHole: 0.4,
        legend: { position: 'bottom' }
      };

      const chart = new google.visualization.PieChart(document.getElementById(contenedor));
      chart.draw(data, options);
    };

    dibujar(ingresos, 'graficoIngresos', 'Distribución de Ingresos');
    dibujar(egresos, 'graficoGastos', 'Distribución de Gastos');
  }

  function logout() {
    auth.signOut().then(() => window.location.href = "../index.html");
  }
});