module.exports = function SettingsHistory(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('settingsHistory', {
      
        id:{
          type: Sequelize.INTEGER,
          autoIncrement:true,
          allowNull:false,
          primaryKey:true
        },
        settings_id: {
          type: Sequelize.INTEGER,
          allowNull:false,
        },
        user_id:{
          type: Sequelize.INTEGER,
          allowNull:false,
        },
        resurvey_period_days: {
          type: Sequelize.INTEGER
        },
        default_pagination_limit: {
          type: Sequelize.INTEGER
        },
        about_content:{
          type: Sequelize.STRING
        },
        survey_closing_date:{
          type: 'TIMESTAMP',
          allowNull: false
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'settings_history',
        timestamps: false
  
      });
  
    return ret;
  }
  