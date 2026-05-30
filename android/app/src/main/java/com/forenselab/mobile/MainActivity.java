package com.forenselab.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registra el plugin nativo de guardado en Galería antes de inicializar el puente.
        registerPlugin(MediaStoreSaver.class);
        super.onCreate(savedInstanceState);
    }
}
