const ML_BASE_URL =
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";


async function classifyEWaste(file) {
  if (!file) {
    throw new Error("Image file is required");
  }

  const formData = new FormData();

  const blob = new Blob(
    [file.buffer],
    { type: file.mimetype }
  );

  formData.append(
    "image",
    blob,
    file.originalname
  );

  const response = await fetch(
    `${ML_BASE_URL}/scrap/classify`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "E-waste classification failed"
    );
  }

  /*
   * Phase 7 compatibility fix (minimal, required for the real agent
   * pipeline to work — see agentTools.js inspectItem, which has always
   * assumed this function returns the flat classifier payload
   * { material, confidence, top_predictions, model_version, status }):
   *
   * FastAPI's /scrap/classify wraps that payload as
   * { success: true, data: { material, confidence, ... } } (see
   * ml-service/app/main.py). This function used to return that
   * envelope unchanged, so every caller assuming a flat
   * `classification.material` (agentTools.js) silently got
   * `classification.material === undefined` instead of a real error —
   * the agent's inspect_item tool "succeeded" with a null category and
   * every downstream stage failed instead. Existing callers of this
   * function (aiController.js, the frontend's classifyItemImage) were
   * already defensively unwrapping both a flat and a `{ data: {...} }`
   * shape, so returning the already-unwrapped flat shape here is
   * backward compatible with both.
   */
  return data && data.success && data.data ? data.data : data;
}


async function predictPrice(payload) {
  const response = await fetch(
    `${ML_BASE_URL}/price/predict`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Price prediction failed"
    );
  }

  // Match predictPrice's output shape to classifyEWaste: unwrap
  // FastAPI's { success, data: {...} } envelope so this service returns
  // the flat payload ({ material, predicted_price, location,
  // model_version, status }) to every caller, exactly like
  // classifyEWaste already does (see the Phase 7 compatibility fix
  // above). Callers that embed this into a larger response therefore
  // don't leak a nested success/data envelope.
  return data && data.success && data.data ? data.data : data;
}


module.exports = {
  classifyEWaste,
  predictPrice
};