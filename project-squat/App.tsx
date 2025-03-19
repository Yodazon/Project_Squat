import React, {useState, useEffect} from 'react'
import { StyleSheet, ViewStyle, Text, View, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, ListRenderItem} from 'react-native'
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { LogBox, PermissionsAndroid, Platform } from 'react-native'
import { useBLE, DeviceCharacteristic } from './useBLE';


LogBox.ignoreLogs(['new NativeEventEmitter'])



export default function App(){
    const{
        scanning,
        devices,
        connectedDevice,
        deviceCharacteristics,
        selectedCharacteristic,
        receivedData,
        controlValue,
        startScan,
        connectToDevice,
        disconnectDevice,
        monitorCharacteristic,
        sendValue,
        cleanup
    } = useBLE();



    //cleanup for when a component unmounts
    useEffect(() =>{
        return () => cleanup();
    }, [])





    //Render device list
    const renderDeviceItem: ListRenderItem<Device> = ({item}) =>(
        <TouchableOpacity
            style={styles.deviceItem}
            onPress={() => connectToDevice(item)}
        >   
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceId}>ID:{item.id}</Text>
            <Text style={styles.deviceRssi}>Signal:{item.rssi} dBm</Text>
        </TouchableOpacity>
    )

    //Render Characteristic List
    const renderCharacteristicItem: ListRenderItem<DeviceCharacteristic> =({item}) =>(
        <TouchableOpacity
            style={[
                styles.characteristicItem,
                selectedCharacteristic?.uuid === item.uuid && styles.selectedCharacteristic
            ]}
            onPress={()=> monitorCharacteristic(item)}
        >
            <Text style={styles.characteristicUuid}>UUID: {item.uuid}</Text>
            <Text style={styles.characteristicProperties}>
                Properties: {JSON.stringify(item)}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Arduino BLE Controller</Text>


            {/* Device Screening Sextion */}
            {!connectedDevice && (
                <>
                    <TouchableOpacity
                        style = {styles.scanButton}
                        onPress = {startScan}
                        disabled={scanning}
                    >
                        <Text style={styles.buttonText}>
                            {scanning ? 'Scanning...': 'Scan for Devices'}
                        </Text>
                    </TouchableOpacity>

                    {scanning && <ActivityIndicator size='large' color='#0000ff' />}

                    <Text style={styles.sectionTitle}>
                        {devices.length > 0 ? 'Available Devices' : 'No devices found'}
                    </Text>

                    <FlatList
                        data ={devices}
                        renderItem={renderDeviceItem}
                        keyExtractor={item => item.id}
                        style = {styles.list}
                    />
                </>
            )}

            {/* Connected device section */}
            {connectedDevice &&(
                <>
                    <View style={styles.connectedDeviceInfo}>
                        <Text style={styles.connectedDeviceTitle}>
                            Connected to: {connectedDevice.name}
                        </Text>
                        <TouchableOpacity
                            style={styles.disconnectButton}
                            onPress={disconnectDevice}
                            >
                                <Text style= {styles.sectionTitle}>Disconnect</Text>
                         </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Available Characteristics</Text>

                    <FlatList
                        data = {deviceCharacteristics}
                        renderItem={renderCharacteristicItem}
                        keyExtractor={item => item.uuid}
                        style={styles.list}
                    />

                    {/* Controls for sending data */}
                    {selectedCharacteristic &&(
                        <View style={styles.controlsContainer}>
                            <Text style={styles.sectionTitle}>Controls</Text>

                            <View style={styles.controlButtons}>
                                <TouchableOpacity
                                    style={styles.controlButton}
                                    onPress={()=> sendValue('1')}
                                >
                                    <Text style={styles.buttonText}>LED ON</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.controlButton}
                                    onPress={() => sendValue('0')}
                                >
                                    <Text style={styles.buttonText}>LED OFF</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Slider controls for analog Values */}
                            <View style={styles.sliderButtons}>
                                {[1,2,3,4,5].map((value) =>(
                                    <TouchableOpacity
                                        key ={value}
                                        style ={[
                                            styles.sliderButton,
                                            controlValue === value && styles.activeSliderButton
                                        ]}
                                        onPress={() => sendValue(value)}
                                    >
                                        <Text style={styles.sliderButtonText}>{value}</Text>
                                    </TouchableOpacity>
                                ))} 
                            </View>

                            <Text style = {styles.sectionTitle}>Received Data:</Text>
                            <ScrollView style={styles.dataContainer}>
                                <Text>{receivedData || 'No data recieved yet'}</Text>
                            </ScrollView>
                        </View>

                    )}
                </>
            )}
        </View>
    )
}


//Define styles
interface Styles{
    container: object;
    title: object;
    scanButton:object;
    disconnectButton: object;
    buttonText: object;
    sectionTitle: object;
    list: object;
    deviceItem: object;
    deviceName: object;
    deviceId: object;
    deviceRssi: object;
    connectedDeviceInfo: object;
    connectedDeviceTitle: object;
    characteristicUuid: object;
    characteristicProperties: object;
    controlsContainer: object;
    controlButtons: object;
    controlButton: object;
    sliderButtons: object;
    sliderButton: object;
    activeSliderButton: object;
    sliderButtonText: object;
    dataContainer: object;
}


//App Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: 50,
        paddingHorizontal:16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    }, 
    scanButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    disconnectButton: {
        backgroundColor: '#F44336',
        padding: 8,
        borderRadius: 8,
    },
    buttonText: {
        color:'white',
        textAlign: 'center',
        fontWeight: 'bold'
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    list: {
        maxHeight:200,
    },
    deviceItem: {
        backgroundColor: 'white',
        padding: 16,
        marginVertical: 8,
        borderRadius: 8,
        elevation: 2,
    },
    deviceName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    deviceId: {
        fontSize: 14,
        color: '#666'
    },
    deviceRssi: {
        fontSize: 14,
        color: '#666'
    },
    connectedDeviceInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center' as ViewStyle['alignItems'], // Explicitly cast alignItems
        backgroundColor: '#E1F5FE',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    connectedDeviceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    characteristicItem: {
        backgroundColor: 'white',
        padding: 12,
        marginVertical: 4,
        borderRadius: 8,
        elevation: 1,
    },
    selectedCharacteristic: {
        backgroundColor: '#E3F2FD',
        borderWidth: 2,
        borderColor: '#2196F3'
    },
    characteristicUuid: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    characteristicProperties: {
        fontSize: 12,
        color: '#666'
    },
    controlsContainer: {
        marginTop: 16,
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        elevation: 2,
    },
    controlButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 12,
    },
    controlButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        minWidth: 120,
    },
    sliderButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 12,
    },
    sliderButton: {
        backgroundColor: '#9E9E9E',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeSliderButton: {
        backgroundColor: '#FF9800',
    },
    sliderButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    dataContainer: {
        backgroundColor: '#ECEFF1',
        padding: 12,
        borderRadius: 8,
        height: 150,
        marginTop: 8,
    }
})