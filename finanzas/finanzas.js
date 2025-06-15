window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM listo");

  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(() =>
    console.log("✅ Google Charts cargado")
  );

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
            <td><span>${data.ahorro.toFixed(2)}</span></td>
            <td><button class="eliminar-btn">❌</button></td>`;
          tbody.appendChild(row);
          const tipoSelect = row.cells[1].querySelector("select");
          actualizarFuente(tipoSelect);
          row.cells[2].querySelector("select").value = data.fuente;
          agregarEventos(row);
          datos.push({ tipo: data.tipo, fuente: data.fuente, monto: data.monto, fecha: data.fecha });
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
      <td><span>0.00</span></td>
      <td><button class="eliminar-btn">❌</button></td>`;
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

    const eliminarBtn = row.querySelector(".eliminar-btn");
    if (eliminarBtn) {
      eliminarBtn.addEventListener("click", () => {
        row.remove();
        generarGraficos(obtenerDatosTabla());
      });
    }
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
      const fecha = row.cells[0].querySelector("input").value;
      datos.push({ tipo, fuente, monto, fecha });
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
      datos.push({ tipo, fuente, monto, fecha });
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
        legend: { position: "bottom" }
      };

      const chart = new google.visualization.PieChart(document.getElementById(contenedor));
      chart.draw(data, options);
    };

    dibujar(ingresos, 'graficoIngresos', 'Distribución de Ingresos');
    dibujar(egresos, 'graficoGastos', 'Distribución de Gastos');

    // === GRÁFICO DE VELAS ===
    const agrupado = {};
    datos.forEach(({ tipo, monto, fecha }) => {
      if (!fecha || isNaN(monto)) return;
      const f = fecha.split("T")[0];
      if (!agrupado[f]) agrupado[f] = { ingreso: 0, egreso: 0 };
      if (tipo === "Ingreso") agrupado[f].ingreso += monto;
      else if (tipo === "Egreso") agrupado[f].egreso += monto;
    });

   // Ordenamos los datos por fecha y hora (si hay hora)
const datosOrdenados = [...datos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

let anteriorCierre = 0;
const filas = datosOrdenados.map(({ tipo, monto, fecha }, i) => {
  const apertura = anteriorCierre;
  const cierre = tipo === "Ingreso" ? apertura + monto : apertura - monto;
  const min = Math.min(apertura, cierre);
  const max = Math.max(apertura, cierre);
  anteriorCierre = cierre;

  const [year, month, day] = fecha.split("-").map(Number);
  const fechaDate = new Date(year, month - 1, day);
  fechaDate.setSeconds(i); // evitar solapamiento visual

  return [fechaDate, min, apertura, cierre, max];
});




    const dataCandle = new google.visualization.DataTable();
dataCandle.addColumn('date', 'Fecha');
dataCandle.addColumn('number', 'Mínimo');
dataCandle.addColumn('number', 'Apertura');
dataCandle.addColumn('number', 'Cierre');
dataCandle.addColumn('number', 'Máximo');
dataCandle.addRows(filas);


    const optionsCandle = {
      title: "Ingresos y Egresos diarios (vela financiera)",
      legend: "none",
      bar: { groupWidth: '70%' },
      candlestick: {
        fallingColor: { strokeWidth: 0, fill: '#d9534f' },
        risingColor: { strokeWidth: 0, fill: '#5cb85c' }
      },
      hAxis: {
    title: "Fecha",
    format: "MMM d", // 👈 esto oculta la hora y zona horaria
    slantedText: false
  },
      vAxis: { title: "Monto" }
    };

    const chartCandle = new google.visualization.CandlestickChart(document.getElementById("graficoCascada"));
    chartCandle.draw(dataCandle, optionsCandle);
  }

  window.toggleTodosGraficos = function (btn) {
    const ingresos = document.getElementById("graficoIngresos");
    const gastos = document.getElementById("graficoGastos");
    const ocultar = !ingresos.classList.contains("hidden");

    ingresos.classList.toggle("hidden", ocultar);
    gastos.classList.toggle("hidden", ocultar);

    btn.textContent = ocultar ? "+ Mostrar gráficos" : "− Ocultar gráficos";
  };

  window.toggleGrafico = function (id, btn) {
    const el = document.getElementById(id);
    el.classList.toggle("hidden");
    btn.textContent = el.classList.contains("hidden") ? "+ Mostrar" : "− Ocultar";
  };

  window.agregarFila = agregarFila;
  window.guardarEntradas = guardarEntradas;
  window.logout = function () {
    auth.signOut().then(() => window.location.href = "../index.html");
  };
});
