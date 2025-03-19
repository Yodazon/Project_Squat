import React, {useState, useEffect} from 'react'
import { StyleSheet, ViewStyle, Text, View, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, ListRenderItem} from 'react-native'
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { LogBox, PermissionsAndroid, Platform } from 'react-native'
import * as ExpoDevice from 'expo-device';
import * as Location from 'expo-location';

LogBox.ignoreLogs(['new NativeEventEmitter'])

const bleManager = new BleManager()
//Define interface
interface DeviceCharacteristic extends Characteristic{

}


export default function App(){
    const [scanning, setScanning] = useState<boolean>(false)
    const [devices, setDevices] = useState<Device[]>([])
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null)
    const [deviceCharacteristics, setDeviceCharacteristics] = useState<DeviceCharacteristic[]>([])
    const [selectedCharacteristic, setSelectedCharacteristic] = useState<DeviceCharacteristic | null>(null)
    const [recievedData, setRecievedData] = useState<string>("")
    const [controlValue, setControlValue] = useState<number>(0)

    useEffect(() =>{

        let isMounted = true; // Track whether component is mounted
            


        const checkPermissions = async (): Promise<void> =>{
            if (!isMounted) return;
            if (ExpoDevice.osName !== 'Android' && ExpoDevice.osName !== 'iOS'){
                alert('BLE only allowed on iOS and Android')
                return;
            }

            try{
                if (Platform.OS == 'ios'){
                    //iOS handling

                    const {status} = await Location.requestBackgroundPermissionsAsync()
                    if (status !== 'granted'){
                        alert('Location permission is required to use Bluetooth on iOS');
                    }
                } else if (Platform.OS == 'android'){
                    //Android handling
                    const apiLevel = ExpoDevice.osVersion ? parseInt(ExpoDevice.osVersion, 10) : 0;

                    //Android 12+ (API level 31+) needs BLUETOOTH_SCAN and BLUETOOTH_CONNECT
                    if (apiLevel >= 31){
                        const bluetoothScanStatus = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                            {
                                title: 'Bluetooth Scan Permission',
                                message: 'This app requires Bluetooth scanning permission to find devices',
                                buttonPositive:'OK',
                            }
                        );
                        
                        const bluetoothConnectStatus = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                            {
                                title: 'Bluetooth Connect Permission',
                                message: 'This app requires bluetooth connection permission to connect to devices',
                                buttonPositive: 'OK',
                            }
                        );
                        const fineLocationStatus = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                            {
                                title: 'Location Permission',
                                message: 'This app requires fine location permission to find nearby bluetooth devices',
                                buttonPositive: 'OK',
                            }
                        );
                        if (
                            bluetoothConnectStatus !== 'granted' ||
                            bluetoothScanStatus !== 'granted' ||
                            fineLocationStatus !== 'granted'
                        ){
                            alert('Bluetooth and Location permissions are required for proper functionality')
                        }

                    }else{//Android 6 - 11
                        const fineLocationStatus = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                            {
                                title: 'Location Permission',
                                message: 'This app requires fine location permission to find nearby bluetooth devices',
                                buttonPositive: 'OK',
                            }
                        );
                        if (fineLocationStatus !=='granted'){
                            alert('Location permissions is required for functionality on Android')
                        }
                    }

                }
            } catch(error){
                console.error('Error Checking Permissions:', error)
            }
        };
        checkPermissions();
        
        return () =>{
            isMounted = false; // Prevent running if unmounted

            //Clean up BLE resources when component unmounts
            if (connectedDevice){
                bleManager.cancelDeviceConnection(connectedDevice.id)
            }
        }
    }, []);


    //Scan for BLE Devices
    const startScan = (): void =>{
        if (scanning) return;

        //Clear previous devices
        setDevices([])
        setScanning(true)

        bleManager.startDeviceScan(null, null, (error,device) =>{
            if (error){
                console.error('Scan error:', error)
                setScanning(false)
                return;
            }
            
            //add devices with names
            if(device && device.name?.includes("Arduino")){
                //Check if it is already on the list
                setDevices(prevDevices  =>{
                    if (!prevDevices.find(d => d.id === device.id)){
                        return [...prevDevices, device]
                    }
                    return prevDevices
                })
            }
        })
        //Stop scanning after 10 seconds
        setTimeout (() =>{
            bleManager.stopDeviceScan();
            setScanning(false);
        }, 10000);
    };

    //Connect to selected Device
    const connectToDevice = async (device: Device): Promise<void> =>{
        try{
            setScanning(false);
            bleManager.stopDeviceScan();

            //Connect to the device
            const connectedDevice = await bleManager.connectToDevice(device.id)
            setConnectedDevice(connectedDevice)

            //Discover all services and characteristics
            await connectedDevice.discoverAllServicesAndCharacteristics()
            const services = await connectedDevice.services()

            // Get all characteristics from all services
            let allCharacteristics: DeviceCharacteristic[] =[];
            for (const service of services){
                const characteristics = await service.characteristics();
                allCharacteristics = [...allCharacteristics, ...characteristics as DeviceCharacteristic[]];
            }

            setDeviceCharacteristics(allCharacteristics)

            //Setup monitoring for device disconnection
            connectedDevice.onDisconnected(() =>{
                setConnectedDevice(null)
                setDeviceCharacteristics([])
                setSelectedCharacteristic(null) 
                setRecievedData('')
                alert('Device Disconnected')
            });

        }catch (error: any){
            console.error('Connection Error:', error)
            alert(`Connection Error: ${error.message}`)
        };
    }

    //Disconnect from current device
    const disconnectDevice = async (): Promise<void> =>{
        if (connectedDevice){
            await bleManager.cancelDeviceConnection(connectedDevice.id)
            setConnectedDevice(null);
            setDeviceCharacteristics([]);
            setSelectedCharacteristic(null)
            setRecievedData('')
        }
    }

    //Monitor a characteristic for notifications/indicators
    const monitorCharacteristic = async (characteristic: DeviceCharacteristic): Promise<void> =>{
        try{
            setSelectedCharacteristic(characteristic)

            //Start monitoring the characteristic for changes 
            characteristic.monitor((error,char) =>{
                if (error){
                    console.error('Monitoring error:', error)
                    return;
                }

                //Convert the recieved value to a string
                if (char && char.value){
                    const decodedValue = base64ToAscii(char.value)
                    setRecievedData(prev => prev + decodedValue + '\n')
                }
            })
            alert(`Monitoring characteristic: ${characteristic.uuid}`)
        } catch (error:any){
            console.error('Error Setting up monitor:',error)
            alert(`Error: ${error.message}`)
        }
    }

    //Send value to Arduino
    const sendValue = async (value:string | number): Promise<void> =>{
        if (!selectedCharacteristic){
            alert('Please select a characteristic First')
            return;
        }

        try{
            //Convert value to an ASCII string then to base64
            const data = asciiToBase64(value.toString())

            //Write the value to the characteristic
            await selectedCharacteristic.writeWithResponse(data)

            //Update the control value
            if (typeof value === 'number'){
                setControlValue(value)
            } else{
                const numericValue = parseInt(value,10)
                if (!isNaN(numericValue)){
                    setControlValue(numericValue)
                }
            }
        } catch (error:any){
            console.error('Write Error:', error)
            alert(`Write error: ${error.message}`)
        }
    };

    //Helper functions for base64 conversion
    const base64ToAscii = (base64: string): string =>{
        try{
            return Buffer.from(base64, 'base64').toString('ascii')
        }catch (error){
            return atob(base64)
        }
    }

    const asciiToBase64 = (ascii:string): string =>{
        try{
            return Buffer.from(ascii).toString('base64')
        } catch (error){
            return btoa(ascii)
        }
    }

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
                                <Text style= {styles.sectionTitle}>Available Characteristics</Text>
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
                                <Text>{recievedData || 'No data recieved yet'}</Text>
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
        backgroundColor: '#E3F2D',
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