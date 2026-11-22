package com.ingles.triade;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InglesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
